import { GIFEncoder, quantize, applyPalette } from 'gifenc';
let encoder:ReturnType<typeof GIFEncoder>;
self.onmessage=(e:MessageEvent)=>{
  try {
    if(e.data.type==='start'){encoder=GIFEncoder();self.postMessage({type:'ready'});}
    if(e.data.type==='frame'){
      const rgba=new Uint8Array(e.data.rgba);const palette=quantize(rgba,128);const indexed=applyPalette(rgba,palette);
      encoder.writeFrame(indexed,e.data.width,e.data.height,{palette,delay:250,repeat:0});self.postMessage({type:'frame'});
    }
    if(e.data.type==='finish'){encoder.finish();const bytes=encoder.bytes();self.postMessage({type:'done',bytes});}
  }catch{self.postMessage({type:'error'});}
};
