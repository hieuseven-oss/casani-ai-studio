import {NavLink} from 'react-router-dom';
import {LayoutDashboard,PlusSquare,Lamp,FolderClock,Settings,LogOut} from 'lucide-react';
export default function Layout({children}:{children:React.ReactNode}){
 const nav=[['/','Dashboard',LayoutDashboard],['/create','Create',PlusSquare],['/products','Products',Lamp],['/projects','Projects',FolderClock],['/settings','Settings',Settings]] as const;
 return <div className="app"><aside><div className="brand"><div className="brandmark">C</div><div><b>CASANI</b><span>AI STUDIO</span></div></div><nav>{nav.map(([to,label,I])=><NavLink key={to} to={to} end={to==='/' } className={({isActive})=>isActive?'active':''}><I size={19}/>{label}</NavLink>)}</nav><div className="profile"><div className="avatar">CA</div><div><b>Casani Lighting</b><span>Admin</span></div><LogOut size={17}/></div></aside><main>{children}</main></div>
}
