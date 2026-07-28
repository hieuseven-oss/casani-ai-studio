export type Product={id:string;sku:string;name:string;imageUrl:string;category:string;createdAt:string};
export type Project={id:string;productId:string;productName:string;space:string;style:string;mood:string;ratio:string;createdAt:string;outputs:string[]};
const K1='casani_products',K2='casani_projects';
export const getProducts=():Product[]=>JSON.parse(localStorage.getItem(K1)||'[]');
export const saveProducts=(x:Product[])=>localStorage.setItem(K1,JSON.stringify(x));
export const getProjects=():Project[]=>JSON.parse(localStorage.getItem(K2)||'[]');
export const saveProjects=(x:Project[])=>localStorage.setItem(K2,JSON.stringify(x));
export const uid=()=>crypto.randomUUID();
