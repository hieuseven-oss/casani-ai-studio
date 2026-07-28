import {Routes,Route} from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';import Create from './pages/Create';import Results from './pages/Results';import Products from './pages/Products';import Projects from './pages/Projects';import SettingsPage from './pages/Settings';
export default function App(){return <Layout><Routes><Route path="/" element={<Dashboard/>}/><Route path="/create" element={<Create/>}/><Route path="/results/:id" element={<Results/>}/><Route path="/products" element={<Products/>}/><Route path="/projects" element={<Projects/>}/><Route path="/settings" element={<SettingsPage/>}/></Routes></Layout>}
