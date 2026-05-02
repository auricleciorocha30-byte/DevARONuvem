-- Tabela de Perfis de Loja
CREATE TABLE IF NOT EXISTS store_profiles (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    logoUrl TEXT,
    address TEXT,
    whatsapp TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt INTEGER,
    settings TEXT
);

-- Tabela de Categorias
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id TEXT,
    name TEXT NOT NULL,
    UNIQUE(store_id, name)
);

-- Tabela de Produtos
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    store_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL,
    category TEXT,
    imageUrl TEXT,
    isActive INTEGER DEFAULT 1,
    featuredDay INTEGER,
    isByWeight INTEGER DEFAULT 0,
    barcode TEXT,
    stock INTEGER DEFAULT 0
);

-- Tabela de Funcionários
CREATE TABLE IF NOT EXISTS waitstaff (
    id TEXT PRIMARY KEY,
    store_id TEXT,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
);

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    store_id TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    cpf TEXT,
    address TEXT,
    points INTEGER DEFAULT 0,
    isLoyaltyParticipant INTEGER DEFAULT 1,
    createdAt INTEGER
);
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id TEXT,
    displayId TEXT,
    type TEXT,
    tableNumber TEXT,
    customerName TEXT,
    customerPhone TEXT,
    customerId TEXT,
    items TEXT,
    status TEXT,
    total REAL,
    deliveryFee REAL,
    createdAt INTEGER,
    paymentMethod TEXT,
    deliveryAddress TEXT,
    referencePoint TEXT,
    notes TEXT,
    changeFor REAL,
    waitstaffName TEXT,
    couponApplied TEXT,
    discountAmount REAL,
    customerCpf TEXT
);
