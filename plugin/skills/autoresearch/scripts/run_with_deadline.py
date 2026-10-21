#!/usr/bin/env python3
"""Run one argv-safe command with a portable wall-clock deadline.

Usage: python3 run_with_deadline.py <seconds> -- <command> [args...]

The command runs in its own session and process group on POSIX, or a new process group on Windows, with no shell, so
arguments are passed as given. Exit codes: the command's own status when it finishes in time;
124 deadline exceeded with cleanup confirmed; 125 deadline exceeded and cleanup of the process tree
could not be confirmed (inspect for leftover processes before the next iteration); 127 command not
found; 2 usage error. Python 3.8+ standard library only.
"""

import argparse
import math
import os
import signal
import subprocess
import sys
import time
from typing import List, Optional


REAP_TIMEOUT_SECONDS = 2.0


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a command with a Python standard-library deadline."
    )
    parser.add_argument("seconds", type=float, help="Positive wall-clock deadline in seconds.")
    parser.add_argument("command", nargs=argparse.REMAINDER, help="Command argv after --.")
    args = parser.parse_args(argv)
    if args.command and args.command[0] == "--":
        args.command = args.command[1:]
    if not math.isfinite(args.seconds) or args.seconds <= 0:
        parser.error("seconds must be finite and greater than zero")
    if not args.command:
        parser.error("a command is required after --")
    return args


def _spawn(command: List[str]) -> subprocess.Popen:
    if os.name == "posix":
        return subprocess.Popen(command, start_new_session=True)
    if os.name == "nt":
        return subprocess.Popen(
            command,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
    return subprocess.Popen(command)


def _reap(process: subprocess.Popen) -> bool:
    try:
        process.wait(timeout=REAP_TIMEOUT_SECONDS)
        return True
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
        return False


def _known_posix_descendants(parent_pid: int) -> List[int]:
    """Return one best-effort snapshot; this is discovery, not containment proof."""
    try:
        result = subprocess.run(
            ["ps", "-axo", "pid=,ppid="],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=REAP_TIMEOUT_SECONDS,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return []
    if result.returncode != 0:
        return []
    children = {}
    for line in result.stdout.splitlines():
        fields = line.split()
        if len(fields) != 2:
            continue
        try:
            pid, ppid = (int(field) for field in fields)
        except ValueError:
            continue
        children.setdefault(ppid, []).append(pid)
    descendants = []
    pending = list(children.get(parent_pid, []))
    while pending:
        pid = pending.pop()
        if pid in descendants:
            continue
        descendants.append(pid)
        pending.extend(children.get(pid, []))
    return descendants


def _alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except (OSError, PermissionError):
        return True
    return True


def _group_alive(pgid: int) -> bool:
    try:
        os.killpg(pgid, 0)
    except ProcessLookupError:
        return False
    except (OSError, PermissionError):
        return True
    return True


def _confirm_posix_gone(pgid: int, descendants: List[int]) -> bool:
    """Poll briefly until the group and every known descendant are gone."""
    deadline = time.monotonic() + REAP_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if not _group_alive(pgid) and not any(_alive(pid) for pid in descendants):
            return True
        time.sleep(0.05)
    return False


def _terminate_posix_group(process: subprocess.Popen):
    try:
        os.killpg(process.pid, signal.SIGSTOP)
    except ProcessLookupError:
        pass
    except (OSError, PermissionError):
        try:
            process.send_signal(signal.SIGSTOP)
        except (OSError, PermissionError):
            pass
    descendants = _known_posix_descendants(process.pid)
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    except (OSError, PermissionError):
        process.kill()
    for pid in reversed(descendants):
        try:
            os.kill(pid, signal.SIGKILL)
        except (ProcessLookupError, OSError, PermissionError):
            pass
    _reap(process)
    confirmed = _confirm_posix_gone(process.pid, descendants)
    return (confirmed, f"process-group+{len(descendants)}-known-descendant(s)")


def _terminate_windows_tree(process: subprocess.Popen) -> str:
    try:
        result = subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=REAP_TIMEOUT_SECONDS,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        process.kill()
        _reap(process)
        return "process-only"
    _reap(process)
    return "taskkill-tree" if result.returncode == 0 else "process-only"


def _terminate_tree(process: subprocess.Popen):
    if os.name == "posix":
        return _terminate_posix_group(process)
    if os.name == "nt":
        return (False, _terminate_windows_tree(process))
    process.kill()
    _reap(process)
    return (False, "process-only")


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    try:
        process = _spawn(args.command)
    except FileNotFoundError as error:
        print(f"command not found: {error.filename}", file=sys.stderr)
        return 127
    try:
        return process.wait(timeout=args.seconds)
    except subprocess.TimeoutExpired:
        cleanup_complete, cleanup_type = _terminate_tree(process)
        if cleanup_complete:
            print(f"deadline exceeded after {args.seconds:g} seconds; cleanup={cleanup_type}", file=sys.stderr)
        else:
            print(
                "BLOCKED_PROCESS_TREE_CLEANUP_UNVERIFIED: deadline exceeded after "
                f"{args.seconds:g} seconds; best-effort cleanup={cleanup_type}; "
                "manually inspect and stop residual processes",
                file=sys.stderr,
            )
        return 124 if cleanup_complete else 125


if __name__ == "__main__":
    sys.exit(main())
