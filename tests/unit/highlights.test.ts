import {describe,it,expect} from 'vitest';
import {clickHighlight,upgradeClickHighlights} from '../../src/highlights';
import {createBook,type Annotation} from '../../src/types';

describe('click highlights',()=>{
  it('underlines the full accessible link rather than centering on a hand cursor',()=>{
    const target={x:.15,y:.2,x2:.45,y2:.23};
    const left=clickHighlight({x:.16,y:.21,target},1920,1080);
    const right=clickHighlight({x:.44,y:.21,target},1920,1080);
    expect(left).toMatchObject({type:'highlight',x:.15,x2:.45,y2:.23});
    expect(left.y).toBeGreaterThan(.22);expect(left.y).toBeLessThan(.23);
    expect({...left,id:''}).toEqual({...right,id:''});
  });
  it('rejects page-sized, stale and non-finite accessibility bounds',()=>{
    const fallback=clickHighlight({x:.4,y:.5},1920,1080);
    for(const target of [{x:0,y:0,x2:1,y2:1},{x:.1,y:.1,x2:.2,y2:.12},{x:.3,y:.4,x2:NaN,y2:.5}]){
      expect({...clickHighlight({x:.4,y:.5,target},1920,1080),id:''}).toEqual({...fallback,id:''});
    }
  });
  it('keeps markers inside screenshots at every corner',()=>{
    for(const x of [0,1])for(const y of [0,1]){
      const a=clickHighlight({x,y},1920,1080);
      for(const n of [a.x,a.x2,a.y,a.y2])expect(n).toBeGreaterThanOrEqual(0);
      for(const n of [a.x,a.x2,a.y,a.y2])expect(n).toBeLessThanOrEqual(1);
      expect(a.x2).toBeGreaterThan(a.x);expect(a.y2).toBeGreaterThan(a.y);
    }
  });
  it('upgrades only the legacy generated circle, leaving hand annotations intact',()=>{
    const generated:Annotation={id:'generated',type:'circle',x:.375,y:.46,x2:.425,y2:.54,text:''};
    const manual:Annotation={id:'manual',type:'circle',x:.1,y:.2,x2:.5,y2:.7,text:''};
    const book=createBook('Legado','SDR');book.steps=[{id:'step',title:'Clique',time:0,endTime:1,instruction:'',transcript:'',source:'click',action:{x:.4,y:.5,button:'left'},annotations:[generated,manual]}];
    const upgraded=upgradeClickHighlights(book);
    expect(upgraded.steps[0].annotations[0]).toMatchObject({id:'generated',type:'highlight'});
    expect(upgraded.steps[0].annotations[1]).toBe(manual);
    expect(book.steps[0].annotations[0]).toBe(generated);
    expect(upgradeClickHighlights(upgraded)).toBe(upgraded);
  });
});
