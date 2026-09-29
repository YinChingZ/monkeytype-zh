const {defaults,clean}=MTZH;
const inputs=Object.fromEntries(Object.keys(defaults).map(key=>[key,document.getElementById(key)]));
let settings=clean();
const status=document.getElementById('status');
function render() {
  for (const [key,input] of Object.entries(inputs)) {
    if (input.type==='checkbox') input.checked=settings[key]; else input.value=settings[key];
  }
  inputs.fontSize.disabled=settings.sizeMode==='follow';
  inputs.backgroundOpacity.disabled=!settings.background;
  document.getElementById('opacityValue').textContent=settings.backgroundOpacity+'%';
}
let saving=Promise.resolve();
function save(patch,message='已保存，页面即时生效') {
  // Serialize writes so fast slider changes cannot restore an older value.
  saving=saving.catch(()=>{}).then(()=>chrome.storage.local.set(patch));
  saving.then(()=>{status.textContent=message;}).catch(()=>{status.textContent='保存失败，请重新打开扩展';});
}
for (const input of Object.values(inputs)) input.disabled=true;
chrome.storage.local.get(defaults).then(value=>{
  settings=clean(value);
  for (const input of Object.values(inputs)) input.disabled=false;
  render();
  for (const [key,input] of Object.entries(inputs)) {
    input.addEventListener(input.type==='range'?'input':'change',()=>{
      if (input.type==='number' && input.value==='') {render();return;}
      const value=input.type==='checkbox'?input.checked:typeof defaults[key]==='number'?Number(input.value):input.value;
      settings=clean({...settings,[key]:value});render();save({[key]:settings[key]});
    });
  }
}).catch(()=>{status.textContent='设置加载失败，请重新打开扩展';});
document.getElementById('reset').addEventListener('click',()=>{
  settings={...defaults,enabled:settings.enabled,phonetic:settings.phonetic};render();save(settings,'已恢复默认外观');
});
