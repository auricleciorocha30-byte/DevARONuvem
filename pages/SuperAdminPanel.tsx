
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Store, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  Search, 
  Loader2, 
  Camera, 
  MapPin, 
  Phone, 
  Globe,
  Lock,
  Unlock,
  Copy,
  Check,
  Zap,
  ArrowUpRight,
  UserPlus,
  X,
  Package,
  Layers,
  Edit2,
  ChevronRight,
  ChevronLeft,
  Settings,
  Save,
  LayoutDashboard,
  Users,
  Key,
  Eye,
  EyeOff,
  LogOut,
  Download,
  Upload
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StoreProfile, Product, Waitstaff } from '../types';
import { INITIAL_SETTINGS } from '../constants';

export default function SuperAdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('master_logged_in') === 'true';
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Backup & Restore
  const handleBackupStore = async (store: StoreProfile) => {
      try {
          if ((store as any).dbUrl && (store as any).dbAuthToken) {
              (supabase as any).connectToStore((store as any).dbUrl, (store as any).dbAuthToken);
          } else {
              (supabase as any).disconnectStore();
          }

          const { data, error } = await (supabase as any).backupDatabase(store.id);
          if (error) throw error;

          const blob = new Blob([data], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `backup-${store.slug}-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
      } catch (err) {
          console.error("Erro ao gerar backup:", err);
          alert("Erro ao gerar backup da loja.");
      } finally {
          (supabase as any).disconnectStore();
      }
  };

  const handleRestoreStore = async (e: React.ChangeEvent<HTMLInputElement>, store: StoreProfile) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!confirm(`ATENÇÃO: Restaurar backup para a loja "${store.name}" irá substituir TODOS os dados atuais dela. Deseja continuar?`)) {
          e.target.value = '';
          return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              if ((store as any).dbUrl && (store as any).dbAuthToken) {
                  (supabase as any).connectToStore((store as any).dbUrl, (store as any).dbAuthToken);
              } else {
                  (supabase as any).disconnectStore();
              }

              const json = event.target?.result as string;
              const { success, error } = await (supabase as any).restoreDatabase(json, store.id);
              
              if (!success) throw error;
              
              alert('Backup restaurado com sucesso!');
          } catch (err) {
              console.error("Erro ao restaurar:", err);
              alert('Erro ao restaurar backup. Verifique o arquivo.');
          } finally {
              (supabase as any).disconnectStore();
              e.target.value = '';
          }
      };
      reader.readAsText(file);
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para Gerenciamento de Conteúdo da Loja
  const [editingStore, setEditingStore] = useState<StoreProfile | null>(null);
  const [storeCategories, setStoreCategories] = useState<any[]>([]);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [storeWaitstaff, setStoreWaitstaff] = useState<Waitstaff[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [isManagingContent, setIsManagingContent] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'perfil' | 'inventario' | 'equipe'>('perfil');

  // Estados para Edição de Perfil
  const [editProfileData, setEditProfileData] = useState({
    name: '',
    slug: '',
    address: '',
    whatsapp: '',
    logoUrl: '',
    dbUrl: '',
    dbAuthToken: ''
  });

  // Estados para Gerenciamento de Equipe
  const [newUserFormData, setNewUserFormData] = useState({
    name: '',
    password: '',
    role: 'ATENDENTE' as 'GERENTE' | 'ATENDENTE'
  });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Estados para Novo Produto Manual
  const [showProductForm, setShowProductForm] = useState(false);
  const [productFormData, setProductFormData] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    category: '',
    imageUrl: '',
    isActive: true
  });
  const productImgInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    address: '',
    whatsapp: '',
    logoUrl: '',
    dbUrl: '',
    dbAuthToken: ''
  });

  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [globalSettingsData, setGlobalSettingsData] = useState({
    dbUrl: localStorage.getItem('master_db_url') || '',
    dbAuthToken: localStorage.getItem('master_db_token') || ''
  });

  const handleSaveGlobalSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSettingsData.dbUrl) {
      localStorage.setItem('master_db_url', globalSettingsData.dbUrl);
    } else {
      localStorage.removeItem('master_db_url');
    }
    
    if (globalSettingsData.dbAuthToken) {
      localStorage.setItem('master_db_token', globalSettingsData.dbAuthToken);
    } else {
      localStorage.removeItem('master_db_token');
    }
    
    alert('Configurações globais salvas com sucesso! A página será recarregada.');
    window.location.reload();
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_profiles')
        .select('id, name, slug, isActive, isactive, createdat, createdAt, address, whatsapp, dbUrl, dbAuthToken')
        .order('createdAt', { ascending: false });
      
      if (data) {
        const mapped = (data as any[]).map(s => {
          let parsedSettings = {};
          if (typeof s.settings === 'string') {
              try {
                  parsedSettings = JSON.parse(s.settings);
              } catch (e) {
                  console.error("Error parsing settings for store", s.id, e);
              }
          } else if (s.settings) {
              parsedSettings = s.settings;
          }
          
          return {
            ...s,
            id: s.id,
            isActive: s.isactive ?? s.isActive ?? true,
            logoUrl: s.logourl ?? s.logoUrl ?? '',
            createdAt: Number(s.createdat ?? s.createdAt ?? Date.now()),
            settings: parsedSettings
          };
        });
        setStores(mapped);
      }
    } catch (err) {
      console.error("Erro ao buscar lojas:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManageContent = async (store: StoreProfile) => {
    setLoading(true);
    try {
      // Fetch the full store profile including logoUrl and settings
      const { data: fullStoreData, error } = await supabase
        .from('store_profiles')
        .select('*')
        .eq('id', store.id)
        .maybeSingle();

      if (error || !fullStoreData) {
        alert("Erro ao carregar dados completos da loja.");
        setLoading(false);
        return;
      }

      const fullStore = {
        ...fullStoreData,
        id: fullStoreData.id,
        isActive: fullStoreData.isactive ?? fullStoreData.isActive ?? true,
        logoUrl: fullStoreData.logourl ?? fullStoreData.logoUrl ?? '',
        createdAt: Number(fullStoreData.createdat ?? fullStoreData.createdAt ?? Date.now()),
        settings: fullStoreData.settings
      } as StoreProfile;

      setEditingStore(fullStore);
      setEditProfileData({
        name: fullStore.name,
        slug: fullStore.slug,
        address: fullStore.address,
        whatsapp: fullStore.whatsapp,
        logoUrl: fullStore.logoUrl,
        dbUrl: (fullStore as any).dbUrl || '',
        dbAuthToken: (fullStore as any).dbAuthToken || ''
      });
      setIsManagingContent(true);
      setActiveSubTab('perfil');
      
      // Connect to store DB if it has one
      if ((fullStore as any).dbUrl && (fullStore as any).dbAuthToken) {
          (supabase as any).connectToStore((fullStore as any).dbUrl, (fullStore as any).dbAuthToken);
      } else {
          (supabase as any).disconnectStore();
      }
      
      fetchStoreData(fullStore.id);
    } catch (err) {
      console.error("Erro ao gerenciar conteúdo:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStoreData = async (storeId: string) => {
    try {
      const [catRes, prodRes, staffRes] = await Promise.all([
        supabase.from('categories').eq('store_id', storeId).select('*'),
        supabase.from('products').eq('store_id', storeId).select('*'),
        supabase.from('waitstaff').eq('store_id', storeId).select('*')
      ]);
      
      setStoreCategories(catRes.data || []);
      
      if (prodRes.data) {
          const mappedProds = prodRes.data.map((p: any) => ({
              ...p,
              id: p.id || Math.random().toString(),
              isActive: p.isactive ?? p.isActive ?? true,
              imageUrl: p.imageurl ?? p.imageUrl ?? ''
          }));
          setStoreProducts(mappedProds);
      } else {
          setStoreProducts([]);
      }
      
      setStoreWaitstaff(staffRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados da unidade:", err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    setIsSaving(true);
    
    const updatedSettings = {
        ...editingStore.settings,
        storeName: editProfileData.name,
        logoUrl: editProfileData.logoUrl,
        address: editProfileData.address,
        whatsapp: editProfileData.whatsapp
    };

    const { error } = await supabase
      .from('store_profiles')
      .eq('id', editingStore.id)
      .update({
        name: editProfileData.name,
        slug: editProfileData.slug,
        address: editProfileData.address,
        whatsapp: editProfileData.whatsapp,
        logourl: editProfileData.logoUrl,
        settings: JSON.stringify(updatedSettings),
        dbUrl: editProfileData.dbUrl,
        dbAuthToken: editProfileData.dbAuthToken
      });
    
    if (error) alert("Erro ao atualizar perfil");
    else {
      alert("Perfil atualizado com sucesso!");
      fetchStores();
    }
    setIsSaving(false);
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !editingStore) return;
    const { error } = await supabase.from('categories').insert([{
      store_id: editingStore.id,
      name: newCatName.trim()
    }]);
    if (error) alert("Erro ao adicionar categoria (já existe ou erro de conexão)");
    else {
      setNewCatName('');
      fetchStoreData(editingStore.id);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm("Remover esta categoria?")) return;
    await supabase.from('categories').eq('id', id).delete();
    fetchStoreData(editingStore!.id);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    
    const productToSave = {
      id: Math.random().toString(36).substr(2, 9),
      store_id: editingStore.id,
      name: productFormData.name,
      description: productFormData.description,
      price: Number(productFormData.price),
      category: productFormData.category,
      imageurl: productFormData.imageUrl,
      isactive: true
    };

    const { error } = await supabase.from('products').insert([productToSave]);
    if (error) alert("Erro ao salvar produto");
    else {
      setShowProductForm(false);
      setProductFormData({ name: '', description: '', price: 0, category: '', imageUrl: '', isActive: true });
      fetchStoreData(editingStore.id);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("Excluir este produto?")) return;
    await supabase.from('products').eq('id', id).delete();
    fetchStoreData(editingStore!.id);
  };

  const handleAddWaitstaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore || !newUserFormData.name || !newUserFormData.password) return;
    
    const { error } = await supabase.from('waitstaff').insert([{
      store_id: editingStore.id,
      name: newUserFormData.name,
      password: newUserFormData.password,
      role: newUserFormData.role
    }]);

    if (error) {
      alert("Erro ao criar usuário: " + (error.message || "Verifique os dados."));
    } else {
      setNewUserFormData({ name: '', password: '', role: 'ATENDENTE' });
      fetchStoreData(editingStore.id);
    }
  };

  const handleDeleteWaitstaff = async (id: string) => {
    if (!window.confirm("Excluir este acesso definitivamente?")) return;
    await supabase.from('waitstaff').eq('id', id).delete();
    fetchStoreData(editingStore!.id);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const slug = formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    const newStore = {
      name: formData.name,
      slug: slug,
      address: formData.address,
      whatsapp: formData.whatsapp,
      logourl: formData.logoUrl || INITIAL_SETTINGS.logoUrl,
      isactive: true,
      createdat: Date.now(),
      dbUrl: formData.dbUrl ? formData.dbUrl.trim() : '',
      dbAuthToken: formData.dbAuthToken ? formData.dbAuthToken.trim() : '',
      settings: JSON.stringify({ 
        ...INITIAL_SETTINGS, 
        storeName: formData.name,
        logoUrl: formData.logoUrl || INITIAL_SETTINGS.logoUrl,
        address: formData.address,
        whatsapp: formData.whatsapp
      })
    };

    const { data: storeData, error } = await supabase.from('store_profiles').insert([newStore]);
    
    if (error) {
        alert("Erro ao criar loja");
    } else {
      const createdStore = storeData?.[0];
      
      if (createdStore) {
          // Connect to the new store's DB if it has one
          if (createdStore.dbUrl && createdStore.dbAuthToken) {
              (supabase as any).connectToStore(createdStore.dbUrl, createdStore.dbAuthToken);
              // Wait a moment for schema initialization
              await new Promise(resolve => setTimeout(resolve, 1500));
          }

          // Create default admin user
          const adminPayload = {
              store_id: createdStore.id,
              name: 'admin',
              password: 'admin',
              role: 'GERENTE'
          };
          
          await supabase.from('waitstaff').insert([adminPayload]);
          
          // Disconnect to return to Main DB
          (supabase as any).disconnectStore();
      }

      setShowModal(false);
      setFormData({ name: '', slug: '', address: '', whatsapp: '', logoUrl: '', dbUrl: '', dbAuthToken: '' });
      fetchStores();
    }
    setIsSaving(false);
  };

  const handleDeleteStore = async (id: string) => {
    if (!window.confirm("ATENÇÃO: Tem certeza que deseja excluir esta loja?\n\nIsso apagará TODOS os dados (produtos, pedidos, equipe) permanentemente.")) return;
    
    setLoading(true);
    try {
        // Clean up related data
        await supabase.from('products').eq('store_id', id).delete();
        await supabase.from('categories').eq('store_id', id).delete();
        await supabase.from('waitstaff').eq('store_id', id).delete();
        await supabase.from('orders').eq('store_id', id).delete();
        
        // Delete store
        const { error } = await supabase.from('store_profiles').eq('id', id).delete();
        
        if (error) {
            alert("Erro ao excluir loja: " + (error.message || "Erro desconhecido"));
        } else {
            fetchStores();
        }
    } catch (err) {
        console.error("Erro ao excluir:", err);
        alert("Erro ao processar exclusão.");
    } finally {
        setLoading(false);
    }
  };

  const toggleStoreStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('store_profiles').eq('id', id).update({ isactive: !currentStatus });
    fetchStores();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'store' | 'product' | 'edit-perfil') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const result = canvas.toDataURL('image/jpeg', 0.7);
          if (target === 'store') setFormData(prev => ({ ...prev, logoUrl: result }));
          else if (target === 'edit-perfil') setEditProfileData(prev => ({ ...prev, logoUrl: result }));
          else setProductFormData(prev => ({ ...prev, imageUrl: result }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/#/cardapio?loja=${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(slug);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredStores = stores.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUsername === 'master' && loginPassword === 'master123') {
      setIsLoggedIn(true);
      localStorage.setItem('master_logged_in', 'true');
      setLoginError('');
    } else {
      setLoginError('Credenciais inválidas');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('master_logged_in');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6 text-zinc-900">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full animate-scale-up border border-slate-100">
          <div className="flex justify-center mb-8">
            <div className="p-5 bg-secondary rounded-3xl text-primary shadow-inner">
              <ShieldCheck size={48} />
            </div>
          </div>
          <h1 className="text-3xl font-brand font-bold text-center text-slate-800 mb-2">Master Control</h1>
          <p className="text-center text-slate-500 font-medium mb-8">Acesso restrito ao administrador do sistema</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Usuário</label>
              <input 
                required 
                type="text" 
                value={loginUsername} 
                onChange={e => setLoginUsername(e.target.value)} 
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold border border-transparent focus:border-slate-200 transition-all" 
                placeholder="Digite seu usuário"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Senha</label>
              <input 
                required 
                type="password" 
                value={loginPassword} 
                onChange={e => setLoginPassword(e.target.value)} 
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold border border-transparent focus:border-slate-200 transition-all" 
                placeholder="Digite sua senha"
              />
            </div>
            
            {loginError && <p className="text-red-500 text-sm font-bold text-center bg-red-50 py-3 rounded-xl">{loginError}</p>}
            
            <button type="submit" className="w-full py-5 bg-[#001F3F] text-white rounded-[1.8rem] font-bold shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2 mt-4">
              <Lock size={18} /> Acessar Painel
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isManagingContent && editingStore) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] p-6 text-zinc-900">
        <div className="max-w-6xl mx-auto space-y-8">
           <button onClick={() => {
               setIsManagingContent(false);
               (supabase as any).disconnectStore();
           }} className="flex items-center gap-2 text-slate-500 font-bold hover:text-primary transition-all">
             <ChevronLeft /> Voltar para Lojas
           </button>

           <div className="bg-white rounded-[3rem] p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between border border-slate-100 gap-6">
             <div className="flex items-center gap-6">
               <img src={editingStore.logoUrl} className="w-20 h-20 rounded-2xl object-cover border-4 border-slate-50 shadow-sm" alt="Logo" />
               <div>
                 <h1 className="text-3xl font-brand font-bold text-slate-800">{editingStore.name}</h1>
                 <p className="text-sm font-bold text-slate-400">GERENCIAMENTO DE UNIDADE</p>
               </div>
             </div>
             <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveSubTab('perfil')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeSubTab === 'perfil' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}>Perfil</button>
                <button onClick={() => setActiveSubTab('inventario')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeSubTab === 'inventario' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}>Produtos</button>
                <button onClick={() => setActiveSubTab('equipe')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeSubTab === 'equipe' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}>Usuários/Acesso</button>
             </div>
           </div>

           {activeSubTab === 'perfil' ? (
             <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100 animate-scale-up">
                <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2"><Settings className="text-secondary" /> Editar Perfil da Loja</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome da Loja</label>
                            <input required type="text" value={editProfileData.name} onChange={e => setEditProfileData({...editProfileData, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold border border-transparent focus:border-slate-200" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Slug (URL)</label>
                            <input required type="text" value={editProfileData.slug} onChange={e => setEditProfileData({...editProfileData, slug: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold border border-transparent focus:border-slate-200" />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logotipo</label>
                        <div className="flex items-center gap-6">
                            <img src={editProfileData.logoUrl} className="w-24 h-24 rounded-2xl object-cover border-4 border-slate-100 shadow-sm" alt="Preview" />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-2">
                                <Camera size={16} /> Alterar Imagem
                            </button>
                            <input type="file" ref={fileInputRef} onChange={e => handleFileChange(e, 'edit-perfil')} className="hidden" accept="image/*" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">WhatsApp</label>
                            <input type="text" value={editProfileData.whatsapp} onChange={e => setEditProfileData({...editProfileData, whatsapp: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold border border-transparent focus:border-slate-200" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Endereço</label>
                            <input type="text" value={editProfileData.address} onChange={e => setEditProfileData({...editProfileData, address: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold border border-transparent focus:border-slate-200" />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Zap size={16} /> Configuração de Banco de Dados (Opcional)</h3>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Database URL (Turso)</label>
                            <input type="text" value={editProfileData.dbUrl} onChange={e => setEditProfileData({...editProfileData, dbUrl: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-mono text-xs border border-transparent focus:border-slate-200" placeholder="libsql://..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Auth Token</label>
                            <input type="password" value={editProfileData.dbAuthToken} onChange={e => setEditProfileData({...editProfileData, dbAuthToken: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-mono text-xs border border-transparent focus:border-slate-200" placeholder="ey..." />
                        </div>
                    </div>

                    <div className="pt-6">
                        <button disabled={isSaving} type="submit" className="px-10 py-4 bg-primary text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 hover:bg-black transition-all">
                            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Salvar Alterações
                        </button>
                    </div>
                </form>
             </div>
           ) : activeSubTab === 'equipe' ? (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-scale-up">
               <div className="lg:col-span-5 bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 h-fit">
                 <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2">
                   <UserPlus className="text-secondary" /> Novo Acesso Administrativo
                 </h2>
                 <form onSubmit={handleAddWaitstaff} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome do Usuário</label>
                      <input required type="text" value={newUserFormData.name} onChange={e => setNewUserFormData({...newUserFormData, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold border border-transparent focus:border-slate-200" placeholder="ex: gerente.unidade" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Senha de Acesso</label>
                      <input required type="text" value={newUserFormData.password} onChange={e => setNewUserFormData({...newUserFormData, password: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold border border-transparent focus:border-slate-200" placeholder="Defina a senha" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Cargo / Nível</label>
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-1.5 rounded-2xl">
                        <button type="button" onClick={() => setNewUserFormData({...newUserFormData, role: 'ATENDENTE'})} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${newUserFormData.role === 'ATENDENTE' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}>Atendente</button>
                        <button type="button" onClick={() => setNewUserFormData({...newUserFormData, role: 'GERENTE'})} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${newUserFormData.role === 'GERENTE' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}>Gerente</button>
                      </div>
                    </div>
                    <button type="submit" className="w-full py-5 bg-primary text-white rounded-[1.8rem] font-bold shadow-xl hover:bg-black transition-all mt-4">
                      Criar Acesso Unidade
                    </button>
                 </form>
               </div>

               <div className="lg:col-span-7 bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 min-h-[400px]">
                 <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2">
                    <Users className="text-secondary" /> Acessos Cadastrados
                 </h2>
                 <div className="space-y-4">
                    {(storeWaitstaff || []).length === 0 ? (
                      <div className="py-20 text-center text-slate-300 italic">Nenhum usuário administrativo para esta loja.</div>
                    ) : storeWaitstaff.map((user, idx) => (
                      <div key={user.id || idx} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-5 group">
                        <div className={`p-4 rounded-2xl ${user.role === 'GERENTE' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                          <Key size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800">{user.name}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{user.role}</span>
                            <span className="text-[9px] font-bold text-slate-300">|</span>
                            <div className="flex items-center gap-1.5">
                               <span className="text-[10px] font-mono font-bold text-slate-500">
                                 {showPasswords[user.id] ? user.password : '••••••••'}
                               </span>
                               <button onClick={() => togglePasswordVisibility(user.id)} className="p-1 text-slate-300 hover:text-primary">
                                 {showPasswords[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                               </button>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteWaitstaff(user.id)} className="p-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                 </div>
               </div>
             </div>
           ) : (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-scale-up">
               <div className="lg:col-span-4 bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 h-fit">
                 <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                   <Layers className="text-secondary" /> Categorias
                 </h2>
                 <div className="flex gap-2 mb-6">
                   <input 
                     type="text" 
                     value={newCatName} 
                     onChange={e => setNewCatName(e.target.value)}
                     placeholder="Nova categoria..."
                     className="flex-1 px-4 py-3 bg-slate-50 rounded-xl outline-none font-medium border border-slate-100 focus:border-secondary transition-all"
                   />
                   <button onClick={handleAddCategory} className="p-3 bg-secondary text-primary rounded-xl font-bold">
                     <Plus />
                   </button>
                 </div>
                 <div className="space-y-2">
                   {(storeCategories || []).map((cat, idx) => (
                     <div key={cat.id || idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group">
                       <span className="font-bold text-slate-700">{cat.name}</span>
                       <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                         <Trash2 size={16} />
                       </button>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="lg:col-span-8 bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 min-h-[500px]">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Package className="text-secondary" /> Produtos da Loja
                    </h2>
                    <button onClick={() => setShowProductForm(true)} className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-xs flex items-center gap-2">
                      <Plus size={16} /> Novo Produto
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(storeProducts || []).length === 0 ? (
                      <div className="col-span-full py-20 text-center text-slate-300 italic">Nenhum produto cadastrado nesta loja.</div>
                    ) : storeProducts.map((prod, idx) => (
                      <div key={prod.id || idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4 group">
                        {prod.imageUrl ? (
                           <img src={prod.imageUrl} className="w-16 h-16 rounded-xl object-cover" alt={prod.name} />
                        ) : (
                           <div className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400"><Package size={24} /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 truncate">{prod.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{prod.category}</p>
                          <p className="text-sm font-bold text-secondary">R$ {Number(prod.price || 0).toFixed(2)}</p>
                        </div>
                        <button onClick={() => handleDeleteProduct(prod.id)} className="p-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
               </div>
             </div>
           )}
        </div>

        {showProductForm && (
          <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 text-zinc-900">
            <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-scale-up overflow-hidden">
               <div className="p-8 border-b bg-slate-50 flex items-center justify-between">
                 <h3 className="text-2xl font-bold text-slate-800">Novo Produto</h3>
                 <button onClick={() => setShowProductForm(false)} className="text-slate-300 hover:text-slate-500"><X /></button>
               </div>
               <form 
                 onSubmit={handleSaveProduct} 
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                     e.preventDefault();
                   }
                 }}
                 className="p-8 space-y-4"
               >
                 <div className="flex gap-4 items-center mb-4">
                    <div 
                      onClick={() => productImgInputRef.current?.click()}
                      className="w-24 h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative shadow-inner"
                    >
                      {productFormData.imageUrl ? <img src={productFormData.imageUrl} className="w-full h-full object-cover" alt="Thumb" /> : <Camera className="text-slate-300" />}
                      <input type="file" ref={productImgInputRef} onChange={(e) => handleFileChange(e, 'product')} className="hidden" accept="image/*" />
                    </div>
                    <div className="flex-1 space-y-4">
                       <input required type="text" placeholder="Nome do Produto" value={productFormData.name} onChange={e => setProductFormData({...productFormData, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none border border-slate-100 font-bold" />
                       <input required type="number" step="0.01" placeholder="Preço (R$)" value={productFormData.price || ''} onChange={e => setProductFormData({...productFormData, price: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none border border-slate-100 font-bold" />
                    </div>
                 </div>
                 <div className="space-y-4">
                   <textarea placeholder="Descrição curta..." value={productFormData.description} onChange={e => setProductFormData({...productFormData, description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none border border-slate-100 h-24 resize-none font-medium" />
                   <select required value={productFormData.category} onChange={e => setProductFormData({...productFormData, category: e.target.value})} className="w-full px-4 py-4 bg-slate-50 rounded-xl outline-none border border-slate-100 font-bold">
                     <option value="">Selecione a Categoria</option>
                     {(storeCategories || []).map((cat, idx) => <option key={cat.id || idx} value={cat.name}>{cat.name}</option>)}
                   </select>
                 </div>
                 <div className="pt-6 flex gap-4">
                   <button type="button" onClick={() => setShowProductForm(false)} className="flex-1 font-bold text-slate-400">Cancelar</button>
                   <button type="submit" className="flex-[2] py-4 bg-primary text-white rounded-2xl font-bold shadow-xl">Salvar Produto</button>
                 </div>
               </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans">
      <nav className="bg-[#001F3F] text-white px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary rounded-xl text-primary">
            <ShieldCheck size={24} />
          </div>
          <span className="font-brand font-bold text-xl tracking-tight">Master Control <span className="text-secondary font-sans text-[10px] uppercase ml-2 bg-white/10 px-2 py-0.5 rounded">v2.4</span></span>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={() => setShowGlobalSettings(true)} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors font-bold text-sm bg-white/5 px-4 py-2 rounded-xl">
              <Settings size={18} /> Configurações Globais
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors font-bold text-sm bg-white/5 px-4 py-2 rounded-xl">
              <LogOut size={18} /> Sair
            </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-brand font-bold text-slate-800">Unidades do Ecossistema</h1>
            <p className="text-slate-500 font-medium">Controle administrativo centralizado para todas as lojas.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-10 py-5 bg-[#001F3F] text-white font-bold rounded-[1.5rem] shadow-2xl hover:bg-black transition-all active:scale-95 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform" /> Nova Loja Parceira
          </button>
        </div>

        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou slug..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-8 py-6 bg-white rounded-[2rem] border-none outline-none focus:ring-4 focus:ring-[#001F3F]/5 shadow-xl transition-all font-medium text-lg"
          />
        </div>

        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-[#001F3F]" size={64} />
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-[4rem] border-4 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold">Nenhuma loja ativa no sistema.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredStores.map(store => (
              <div key={store.id} className={`bg-white rounded-[3rem] p-8 border-2 transition-all flex flex-col hover:shadow-2xl relative group ${!store.isActive ? 'border-red-100 bg-red-50/20 grayscale' : 'border-white hover:border-secondary shadow-xl'}`}>
                
                {!store.isActive && (
                   <div className="absolute top-6 right-8 bg-red-500 text-white text-[8px] font-black px-3 py-1.5 rounded-full uppercase z-10">SUSPENSA</div>
                )}

                <div className="flex items-center gap-5 mb-8">
                  <img src={store.logoUrl} className={`w-20 h-20 rounded-[1.5rem] object-cover border-4 ${store.isActive ? 'border-secondary' : 'border-slate-200'} shadow-sm`} alt="Logo" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-2xl text-slate-800 truncate">{store.name}</h3>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">/{store.slug}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                  <button onClick={() => handleManageContent(store)} className="flex items-center justify-center gap-2 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-200 transition-all">
                    <Edit2 size={14} /> Gerenciar Unidade
                  </button>
                  <button 
                    onClick={() => toggleStoreStatus(store.id, store.isActive)}
                    className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${store.isActive ? 'bg-red-50 text-red-600' : 'bg-green-600 text-white'}`}
                  >
                    {store.isActive ? <Lock size={14} /> : <Unlock size={14} />} {store.isActive ? 'Bloquear' : 'Reativar'}
                  </button>
                  <a href={`/#/login?loja=${store.slug}`} target="_blank" className="flex items-center justify-center gap-2 py-4 bg-secondary text-primary rounded-2xl font-black text-[10px] uppercase col-span-2 shadow-sm hover:brightness-95" rel="noreferrer">
                    <LayoutDashboard size={14} /> Acessar Painel ADM
                  </a>
                  <a href={`/#/cardapio?loja=${store.slug}`} target="_blank" className="flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase col-span-2 shadow-sm hover:brightness-110" rel="noreferrer">
                    <ArrowUpRight size={14} /> Ver Cardápio Público
                  </a>
                  <button 
                    onClick={() => copyLink(store.slug)}
                    className="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-400 rounded-xl font-black text-[8px] uppercase col-span-2 mt-2 border border-slate-100"
                  >
                    {copiedId === store.slug ? <Check size={12} className="text-green-500" /> : <Copy size={12} />} {copiedId === store.slug ? 'Link Copiado' : 'Copiar Link do Cardápio'}
                  </button>
                  <button 
                    onClick={() => handleDeleteStore(store.id)}
                    className="flex items-center justify-center gap-2 py-3 bg-red-50 text-red-500 rounded-xl font-black text-[8px] uppercase col-span-2 mt-1 border border-red-100 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={12} /> Excluir Loja Permanentemente
                  </button>
                  
                  <div className="col-span-2 grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
                      <button 
                        onClick={() => handleBackupStore(store)}
                        className="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-xl font-black text-[8px] uppercase hover:bg-slate-100 border border-slate-200"
                      >
                        <Download size={12} /> Backup
                      </button>
                      <label className="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-xl font-black text-[8px] uppercase hover:bg-slate-100 border border-slate-200 cursor-pointer">
                        <Upload size={12} /> Restaurar
                        <input type="file" className="hidden" accept=".json" onChange={(e) => handleRestoreStore(e, store)} />
                      </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 text-zinc-900">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl animate-scale-up overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-8 border-b bg-slate-50 flex items-center justify-between shrink-0">
              <h2 className="text-2xl font-brand font-bold text-slate-800">Cadastrar Nova Loja</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-300 hover:text-slate-500"><X size={24}/></button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar">
              <form onSubmit={handleCreateStore} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome Fantasia</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold border border-transparent focus:border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Slug Identificador</label>
                    <input 
                        type="text" 
                        value={formData.slug} 
                        onChange={e => {
                            const val = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                            setFormData({...formData, slug: val});
                        }} 
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold border border-transparent focus:border-slate-200" 
                        placeholder="ex: unidade-centro" 
                    />
                    <p className="text-[10px] text-slate-400 ml-4">Use apenas letras minúsculas, números e hífens.</p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Zap size={16} /> Banco de Dados Dedicado (Opcional)</h3>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Database URL</label>
                        <input type="text" value={formData.dbUrl} onChange={e => setFormData({...formData, dbUrl: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-mono text-xs border border-transparent focus:border-slate-200" placeholder="libsql://..." />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Auth Token</label>
                        <input type="password" value={formData.dbAuthToken} onChange={e => setFormData({...formData, dbAuthToken: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-mono text-xs border border-transparent focus:border-slate-200" placeholder="ey..." />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logotipo</label>
                    <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 bg-slate-50 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer relative overflow-hidden shadow-inner border-slate-200">
                      {formData.logoUrl ? <img src={formData.logoUrl} className="w-full h-full object-cover" alt="Logo" /> : <Camera className="text-slate-300" />}
                      <input type="file" ref={fileInputRef} onChange={e => handleFileChange(e, 'store')} className="hidden" accept="image/*" />
                    </div>
                </div>
                <div className="pt-8 flex gap-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors">Cancelar</button>
                  <button disabled={isSaving} type="submit" className="flex-[2] py-4 bg-[#001F3F] text-white rounded-2xl font-bold shadow-xl hover:brightness-110 transition-all">
                    {isSaving ? <Loader2 className="animate-spin mx-auto" size={24}/> : 'Confirmar Cadastro'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showGlobalSettings && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 text-zinc-900">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl animate-scale-up overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-8 border-b bg-slate-50 flex items-center justify-between shrink-0">
              <h2 className="text-2xl font-brand font-bold text-slate-800">Configurações Globais (Master)</h2>
              <button onClick={() => setShowGlobalSettings(false)} className="p-2 text-slate-300 hover:text-slate-500"><X size={24}/></button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar">
              <form onSubmit={handleSaveGlobalSettings} className="p-8 space-y-6">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium border border-blue-100 mb-6">
                  <p>Estas configurações definem o banco de dados principal do Master Control. Deixe em branco para usar o banco de dados padrão do sistema.</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Database URL (Turso)</label>
                        <input type="text" value={globalSettingsData.dbUrl} onChange={e => setGlobalSettingsData({...globalSettingsData, dbUrl: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-mono text-xs border border-transparent focus:border-slate-200" placeholder="libsql://..." />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Auth Token</label>
                        <input type="password" value={globalSettingsData.dbAuthToken} onChange={e => setGlobalSettingsData({...globalSettingsData, dbAuthToken: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-mono text-xs border border-transparent focus:border-slate-200" placeholder="ey..." />
                    </div>
                </div>
                
                <div className="pt-8 flex gap-4">
                  <button type="button" onClick={() => setShowGlobalSettings(false)} className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-[#001F3F] text-white rounded-2xl font-bold shadow-xl hover:brightness-110 transition-all">
                    Salvar Configurações
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
