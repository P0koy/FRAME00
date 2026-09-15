import React, { createContext, useContext, useState } from 'react';
const DialogCtx=createContext(null);
export function Dialog({children}){const [open,setOpen]=useState(false);return <DialogCtx.Provider value={{open,setOpen}}>{children}</DialogCtx.Provider>}
export function DialogTrigger({asChild,children}){const {setOpen}=useContext(DialogCtx);return asChild?React.cloneElement(children,{onClick:(e)=>{children.props.onClick?.(e);setOpen(true)}}):<button onClick={()=>setOpen(true)}>{children}</button>}
export function DialogContent({children,className=''}){const {open,setOpen}=useContext(DialogCtx);if(!open)return null;return <div className="local-overlay" onMouseDown={(e)=>e.target===e.currentTarget&&setOpen(false)}><div className={className}>{children}<button className="local-close" onClick={()=>setOpen(false)} aria-label="Закрыть">×</button></div></div>}
export function DialogTitle({children,className=''}){return <h2 className={className}>{children}</h2>}
export function DialogDescription({children,className=''}){return <p className={className}>{children}</p>}
export function Button({children,className='',...props}){return <button className={`local-button ${className}`} {...props}>{children}</button>}
export function TooltipProvider({children}){return children}
export function Tooltip({children}){return <span className="local-tooltip">{children}</span>}
export function TooltipTrigger({asChild,children}){return asChild?children:<span>{children}</span>}
export function TooltipContent({children}){return <span className="local-tooltip-content">{children}</span>}
export function Toaster(){return null}
export const toast={success:(title,opts)=>{if(typeof window!=='undefined') window.setTimeout(()=>window.alert(`${title}${opts?.description?`\n${opts.description}`:''}`),10)}};
