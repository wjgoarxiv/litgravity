export function decodeXmlCharacterReferences(value) {
  try{
    const decoded=String(value).replace(/&#(?:x([0-9a-fA-F]+)|([0-9]+));/g,(_entity,hex,decimal)=>{
      const code=Number.parseInt(hex||decimal,hex?16:10);
      if(!Number.isInteger(code)||!(code===9||code===10||code===13||(code>=32&&code<=0xd7ff)||(code>=0xe000&&code<=0xfffd)||(code>=0x10000&&code<=0x10ffff)))throw new Error('invalid XML character reference');
      return String.fromCodePoint(code);
    });
    return decoded.includes('&#')?null:decoded;
  }catch{return null;}
}

export function cssUrlsAreSafe(svg,{allowReference=(value)=>/^#[A-Za-z0-9_.:-]+$/.test(value)}={}) {
  const source=decodeXmlCharacterReferences(svg);
  if(source===null)return false;
  const sourceWithoutComments=source.replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
  const cssParts=[...sourceWithoutComments.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((match)=>match[1]);
  cssParts.push(...[...sourceWithoutComments.matchAll(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map((match)=>match[1]??match[2]??match[3]));
  if(sourceWithoutComments.includes('\\')||/@import\b|\bvar\s*\(|\blocal\s*\(|\bunicode-range\s*:/i.test(sourceWithoutComments)||cssParts.some((part)=>part.includes('&')))return false;
  const url=/url\s*\(/ig;
  let match;
  while((match=url.exec(sourceWithoutComments))){
    let quote=null,end=-1;
    for(let i=url.lastIndex;i<sourceWithoutComments.length;i++){
      const char=sourceWithoutComments[i];
      if(quote){if(char===quote)quote=null;continue;}
      if(char==='"'||char==="'"){quote=char;continue;}
      if(char==='(')return false;
      if(char===')'){end=i;break;}
    }
    if(end<0||quote)return false;
    let value=sourceWithoutComments.slice(url.lastIndex,end).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1).trim();
    if(!allowReference(value))return false;
    url.lastIndex=end+1;
  }
  return true;
}

export function officeCssUrlsAreSafe(svg) {
  return cssUrlsAreSafe(svg);
}

export function officeHrefRefsAreSafe(svg) {
  const decoded=decodeXmlCharacterReferences(svg);
  if(decoded===null)return false;
  if(/<base\b|\bxml:base\s*=/i.test(decoded))return false;
  const source=decoded.replace(/<!--[\s\S]*?-->/g,'');
  const attribute=/\b(?:href|src)\s*=\s*(?:(['"])(.*?)\1|([^\s'"<>`]+))/ig;
  let match;
  while((match=attribute.exec(source))){
    if(!match[1]||!/^#[A-Za-z0-9_.:-]+$/.test(match[2].trim()))return false;
  }
  return true;
}
