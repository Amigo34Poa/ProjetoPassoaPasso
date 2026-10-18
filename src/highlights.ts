import { id, type Annotation, type Playbook } from './types';

export const HIGHLIGHT_COLOR = '#facc15';
export const HIGHLIGHT_OPACITY = 0.38;
export type TargetBounds = { x:number; y:number; x2:number; y2:number };
export type ClickTarget = { x:number; y:number; target?:TargetBounds };
const clamp = (n:number) => Math.max(0, Math.min(1, n));

// Accessible control bounds are preferable to the pointer position. Reject page-sized
// containers and stale targets rather than drawing a highlight across the whole page.
export function clickHighlight(click:ClickTarget, width:number, height:number):Annotation {
  const x=clamp(click.x), y=clamp(click.y), target=click.target;
  const valid=target && Object.values(target).every(Number.isFinite)
    && target.x>=0 && target.y>=0 && target.x2<=1 && target.y2<=1
    && target.x2>target.x && target.y2>target.y
    && target.x2-target.x<=0.7 && (target.y2-target.y)*height<=150
    && x>=target.x && x<=target.x2 && y>=target.y && y<=target.y2;
  let left:number, right:number, top:number, bottom:number;
  if(valid){
    const band=Math.min(12,Math.max(5,(target.y2-target.y)*height*.3))/height;
    left=target.x;right=target.x2;bottom=target.y2;top=Math.max(target.y,bottom-band);
  }else{
    // This is only a position marker: it does not claim to identify a link's text.
    const half=Math.min(.04,32/width), band=7/height;
    left=clamp(x-half);right=clamp(x+half);bottom=clamp(y+10/height);top=Math.max(0,bottom-band);
  }
  return {id:id(),type:'highlight',x:left,y:top,x2:right,y2:bottom,text:''};
}

export function upgradeClickHighlights(book:Playbook):Playbook {
  let changed=false;
  const steps=book.steps.map(step=>{
    if(step.source!=='click'||!step.action)return step;
    const {x,y}=step.action;
    const annotations=step.annotations.map(a=>{
      // Only convert the exact automatic circle used by the previous recorder.
      // Hand-drawn circles and other annotations keep their original meaning.
      if(a.type!=='circle'||a.text||Math.abs(a.x-clamp(x-.025))>1e-6||Math.abs(a.x2-clamp(x+.025))>1e-6||Math.abs(a.y-clamp(y-.04))>1e-6||Math.abs(a.y2-clamp(y+.04))>1e-6)return a;
      changed=true;return {...clickHighlight({x,y},1920,1080),id:a.id};
    });
    return annotations.some((a,i)=>a!==step.annotations[i])?{...step,annotations}:step;
  });
  return changed?{...book,steps}:book;
}
