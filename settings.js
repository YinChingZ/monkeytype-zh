// Shared by the page and extension popup. All settings stay on this device.
globalThis.MTZH = (() => {
  const defaults = {enabled:true,phonetic:true,fontSize:18,sizeMode:'custom',fontFamily:'follow',theme:'follow',position:'below',align:'left',gap:16,offsetX:0,offsetY:0,width:560,border:true,background:true,backgroundOpacity:95,shadow:false,maxLines:3};
  const choices = {sizeMode:['follow','custom'],fontFamily:['follow','system','serif','mono'],theme:['follow','dark','light'],position:['below','above','bottom','top'],align:['left','center','right']};
  const ranges = {fontSize:[12,48],gap:[0,80],offsetX:[-400,400],offsetY:[-300,300],width:[240,800],backgroundOpacity:[0,100],maxLines:[1,6]};
  function clean(value={}) {
    const result={...defaults};
    for (const [key,fallback] of Object.entries(defaults)) {
      const v=value[key];
      if (typeof fallback==='boolean') result[key]=typeof v==='boolean'?v:fallback;
      else if (choices[key]) result[key]=choices[key].includes(v)?v:fallback;
      else if (typeof v==='number'&&Number.isFinite(v)) result[key]=Math.round(Math.min(ranges[key][1],Math.max(ranges[key][0],v)));
    }
    return result;
  }
  return {defaults,clean};
})();
