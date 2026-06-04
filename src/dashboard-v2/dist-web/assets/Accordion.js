import{n as a,H as i,E as e,l as d}from"./main.js";import{C as x}from"./chevron-down.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=[["path",{d:"M14 17H5",key:"gfn3mx"}],["path",{d:"M19 7h-9",key:"6i9tg"}],["circle",{cx:"17",cy:"17",r:"3",key:"18b49y"}],["circle",{cx:"7",cy:"7",r:"3",key:"dfmy0x"}]],p=a("settings-2",l);function u({title:r,children:o,defaultOpen:s=!1}){const[t,n]=i.useState(s);return e.jsxs("div",{className:"bg-card border border-border/50 rounded-[16px] overflow-hidden",children:[e.jsxs("button",{onClick:()=>n(c=>!c),className:"w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-foreground hover:bg-secondary/30 transition-colors text-left",children:[r,e.jsx(x,{className:d("w-4 h-4 text-muted-foreground transition-transform duration-200",t&&"rotate-180")})]}),t&&e.jsx("div",{className:"px-5 pb-5",children:o})]})}export{u as A,p as S};
