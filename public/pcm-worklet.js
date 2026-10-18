class PlaybookPCM extends AudioWorkletProcessor {
  constructor(){super();this.samples=[];this.phase=0;}
  process(inputs){
    const input=inputs[0]?.[0];if(!input)return true;
    const ratio=sampleRate/16000;
    for(let i=0;i<input.length;i++){
      this.phase++;
      if(this.phase>=ratio){this.phase-=ratio;this.samples.push(input[i]);}
    }
    if(this.samples.length>=1600){const buffer=new Float32Array(this.samples);this.port.postMessage(buffer,[buffer.buffer]);this.samples=[];}
    return true;
  }
}
registerProcessor('playbook-pcm',PlaybookPCM);
