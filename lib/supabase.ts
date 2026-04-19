
// import { createClient } from '@libsql/client/http'; // REMOVED to avoid fetch polyfill issues

// ATENÇÃO: Este arquivo simula o cliente do Supabase mas utiliza TURSO (LibSQL) diretamente via fetch nativo.
// A variável 'supabase' exportada é na verdade um cliente Turso customizado.
// Isso permite manter a compatibilidade com o código existente sem reescrever tudo.

const DEFAULT_TURSO_URL = 'https://produtodevaro-auricleciorocha30-byte.aws-us-east-1.turso.io';
const DEFAULT_TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIxMzYwOTMsImlkIjoiMDE5YzliNzctZGMwMS03MmIwLWFmYWItYWRlOGY0MjM5YTBjIiwicmlkIjoiYTQyYjFmY2EtYjc0YS00MGMwLTk3M2QtODlmNmFlMTBkYzFiIn0.A7LAbG4yZ70-XPczvHXgaVUm2t_rJuTlsMpefd86FVprMb50rPZU5aICZdVvQvXpdnwOiav_nNMRCOOmi2cQDQ';

const getTursoUrl = () => typeof window !== 'undefined' ? localStorage.getItem('master_db_url') || DEFAULT_TURSO_URL : DEFAULT_TURSO_URL;
const getTursoAuthToken = () => typeof window !== 'undefined' ? localStorage.getItem('master_db_token') || DEFAULT_TURSO_AUTH_TOKEN : DEFAULT_TURSO_AUTH_TOKEN;

// Native fetch implementation to avoid library side effects
async function executeSql(sql: string, args: any[] = []) {
  // Ensure URL uses https:// instead of libsql://
  let httpUrl = getTursoUrl().trim();
  if (httpUrl.startsWith('libsql://')) {
      httpUrl = httpUrl.replace(/^libsql:\/\//, 'https://');
  } else if (!httpUrl.startsWith('http://') && !httpUrl.startsWith('https://')) {
      httpUrl = 'https://' + httpUrl;
  }
  httpUrl = httpUrl.replace(/\/$/, '');

  const authToken = getTursoAuthToken();

  // Sanitize args for SQLite (convert booleans to ints, etc if needed)
  const sanitizedArgs = args.map(arg => {
    if (typeof arg === 'boolean') return arg ? 1 : 0;
    return arg;
  });

  try {
    const response = await fetch(httpUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        statements: [
          {
            q: sql,
            params: sanitizedArgs
          }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Turso Main DB HTTP Error: ${response.status} ${text}`);
      throw new Error(`Turso HTTP Error ${response.status}: ${text}`);
    }

    const json = await response.json();
    
    // Check for array response (batch results)
    if (!Array.isArray(json)) {
      console.error("Turso Main DB Error: Invalid response format", json);
      throw new Error("Invalid response format from Turso");
    }

    const result = json[0];
    
    if (result.error) {
      const errorMessage = typeof result.error === 'string' ? result.error : (result.error.message || JSON.stringify(result.error));
      console.error("Turso Main DB Query Error:", errorMessage, result);
      throw new Error(errorMessage);
    }

    // Handle empty results (e.g. INSERT/UPDATE without RETURNING)
    if (!result.results) {
        return { rows: [] };
    }

    // Map rows (arrays) to objects using columns
    const { columns, rows } = result.results;
    if (!rows || !columns) {
        return { rows: [] };
    }

    const mappedRows = rows.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, index: number) => {
        obj[col] = row[index];
      });
      return obj;
    });

    return { rows: mappedRows };

  } catch (err: any) {
    console.error("Turso Main DB Execute Error:", {
        message: err.message,
        stack: err.stack,
        url: httpUrl
    });
    if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
        throw new Error(`Falha de conexão com o banco de dados principal (${httpUrl}). Verifique a URL e sua conexão com a internet.`);
    }
    throw err;
  }
}

const client = {
  execute: async (stmt: string | { sql: string, args: any[] }) => {
    if (typeof stmt === 'string') {
      return executeSql(stmt, []);
    } else {
      return executeSql(stmt.sql, stmt.args);
    }
  }
};

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS store_profiles (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    logoUrl TEXT,
    address TEXT,
    whatsapp TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt INTEGER,
    settings TEXT,
    dbUrl TEXT,
    dbAuthToken TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id TEXT,
    name TEXT NOT NULL,
    UNIQUE(store_id, name)
  )`,
  `CREATE TABLE IF NOT EXISTS products (
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
    stock REAL,
    showInMenu INTEGER DEFAULT 1,
    fractions INTEGER,
    units INTEGER,
    fractionPrice REAL,
    ncm TEXT,
    cfop TEXT,
    icms_situacao_tributaria TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS waitstaff (
    id TEXT PRIMARY KEY,
    store_id TEXT,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
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
    deliveryDriverId TEXT,
    paymentDetails TEXT,
    isSynced INTEGER DEFAULT 0,
    originAddress TEXT,
    session_id TEXT,
    serviceFee REAL,
    stockDeducted INTEGER DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS cash_movements (
    id TEXT PRIMARY KEY,
    store_id TEXT,
    type TEXT,
    amount REAL,
    description TEXT,
    waitstaffName TEXT,
    createdAt INTEGER,
    session_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS register_sessions (
    id TEXT PRIMARY KEY,
    store_id TEXT,
    waitstaff_id TEXT,
    waitstaff_name TEXT,
    opened_at INTEGER,
    closed_at INTEGER,
    initial_amount REAL,
    closed_amount REAL,
    status TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    store_id TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    cpf TEXT,
    address TEXT,
    points INTEGER DEFAULT 0,
    isLoyaltyParticipant INTEGER DEFAULT 1,
    createdAt INTEGER
  )`
];

let schemaInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function ensureSchema() {
  if (schemaInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      for (const statement of SCHEMA_STATEMENTS) {
        await client.execute(statement);
      }
      
      // Migration: Add new columns if they don't exist
      try {
          const tableInfo = await client.execute(`PRAGMA table_info(store_profiles)`);
          const columns = tableInfo.rows.map((row: any) => row.name);
          
          if (!columns.includes('dbUrl')) {
              try { await client.execute(`ALTER TABLE store_profiles ADD COLUMN dbUrl TEXT`); } catch (e) { console.warn(e); }
          }
          if (!columns.includes('dbAuthToken')) {
              try { await client.execute(`ALTER TABLE store_profiles ADD COLUMN dbAuthToken TEXT`); } catch (e) { console.warn(e); }
          }

          const ordersTableInfo = await client.execute(`PRAGMA table_info(orders)`);
          const orderColumns = ordersTableInfo.rows.map((row: any) => row.name);
          
          if (!orderColumns.includes('deliveryDriverId')) {
              try { await client.execute(`ALTER TABLE orders ADD COLUMN deliveryDriverId TEXT`); } catch (e) { console.warn(e); }
          }
          if (!orderColumns.includes('paymentDetails')) {
              try { await client.execute(`ALTER TABLE orders ADD COLUMN paymentDetails TEXT`); } catch (e) { console.warn(e); }
          }
          if (!orderColumns.includes('isSynced')) {
              try { await client.execute(`ALTER TABLE orders ADD COLUMN isSynced INTEGER DEFAULT 0`); } catch (e) { console.warn(e); }
          }
          if (!orderColumns.includes('session_id')) {
              try { await client.execute(`ALTER TABLE orders ADD COLUMN session_id TEXT`); } catch (e) { console.warn(e); }
          }
          if (!orderColumns.includes('stockDeducted')) {
              try { 
                  await client.execute(`ALTER TABLE orders ADD COLUMN stockDeducted INTEGER DEFAULT 1`); 
              } catch (e) { 
                  console.warn("Failed to add stockDeducted column:", e); 
              }
          }
          if (!orderColumns.includes('referencePoint')) {
              try { await client.execute(`ALTER TABLE orders ADD COLUMN referencePoint TEXT`); } catch (e) { console.warn(e); }
          }
          if (!orderColumns.includes('originAddress')) {
              try { await client.execute(`ALTER TABLE orders ADD COLUMN originAddress TEXT`); } catch (e) { console.warn(e); }
          }
          if (!orderColumns.includes('displayId')) {
              try { await client.execute(`ALTER TABLE orders ADD COLUMN displayId TEXT`); } catch (e) { console.warn(e); }
          }
          if (!orderColumns.includes('customerId')) {
              try { await client.execute(`ALTER TABLE orders ADD COLUMN customerId TEXT`); } catch (e) { console.warn(e); }
          }
          if (!orderColumns.includes('deliveryFee')) {
              try { await client.execute(`ALTER TABLE orders ADD COLUMN deliveryFee REAL`); } catch (e) { console.warn(e); }
          }
          if (!orderColumns.includes('serviceFee')) {
              try { await client.execute(`ALTER TABLE orders ADD COLUMN serviceFee REAL`); } catch (e) { console.warn(e); }
          }

          const productsTableInfo = await client.execute(`PRAGMA table_info(products)`);
          const productColumns = productsTableInfo.rows.map((row: any) => row.name);
          
          if (!productColumns.includes('stock')) {
              try { await client.execute(`ALTER TABLE products ADD COLUMN stock REAL`); } catch (e) { console.warn(e); }
          }
          if (!productColumns.includes('showInMenu')) {
              try { await client.execute(`ALTER TABLE products ADD COLUMN showInMenu INTEGER DEFAULT 1`); } catch (e) { console.warn(e); }
          }
          if (!productColumns.includes('fractions')) {
              try { await client.execute(`ALTER TABLE products ADD COLUMN fractions INTEGER`); } catch (e) { console.warn(e); }
          }
          if (!productColumns.includes('units')) {
              try { await client.execute(`ALTER TABLE products ADD COLUMN units INTEGER`); } catch (e) { console.warn(e); }
          }
          if (!productColumns.includes('fractionPrice')) {
              try { await client.execute(`ALTER TABLE products ADD COLUMN fractionPrice REAL`); } catch (e) { console.warn(e); }
          }
          if (!productColumns.includes('ncm')) {
              try { await client.execute(`ALTER TABLE products ADD COLUMN ncm TEXT`); } catch (e) { console.warn(e); }
          }
          if (!productColumns.includes('cfop')) {
              try { await client.execute(`ALTER TABLE products ADD COLUMN cfop TEXT`); } catch (e) { console.warn(e); }
          }
          if (!productColumns.includes('icms_situacao_tributaria')) {
              try { await client.execute(`ALTER TABLE products ADD COLUMN icms_situacao_tributaria TEXT`); } catch (e) { console.warn(e); }
          }

          const cashMovementsTableInfo = await client.execute(`PRAGMA table_info(cash_movements)`);
          const cashMovementsColumns = cashMovementsTableInfo.rows.map((row: any) => row.name);
          
          if (!cashMovementsColumns.includes('session_id')) {
              try { await client.execute(`ALTER TABLE cash_movements ADD COLUMN session_id TEXT`); } catch (e) { console.warn(e); }
          }
          
          const waitstaffTableInfo = await client.execute(`PRAGMA table_info(waitstaff)`);
          const waitstaffColumns = waitstaffTableInfo.rows.map((row: any) => row.name);
          
          if (!waitstaffColumns.includes('phone')) {
              try { await client.execute(`ALTER TABLE waitstaff ADD COLUMN phone TEXT`); } catch (e) { console.warn(e); }
          }

          const customersTableInfo = await client.execute(`PRAGMA table_info(customers)`);
          const customerColumns = customersTableInfo.rows.map((row: any) => row.name);

          if (!customerColumns.includes('cpf')) {
              try { await client.execute(`ALTER TABLE customers ADD COLUMN cpf TEXT`); } catch (e) { console.warn(e); }
          }
          if (!customerColumns.includes('address')) {
              try { await client.execute(`ALTER TABLE customers ADD COLUMN address TEXT`); } catch (e) { console.warn(e); }
          }
          if (!customerColumns.includes('referencePoint')) {
              try { await client.execute(`ALTER TABLE customers ADD COLUMN referencePoint TEXT`); } catch (e) { console.warn(e); }
          }
      } catch (e) {
          console.warn("Migration check failed (safe to ignore if columns exist):", e);
      }

      schemaInitialized = true;
    } catch (err) {
      console.error("Erro no Turso Schema:", err);
      initializationPromise = null;
      throw err;
    }
  })();
  return initializationPromise;
}

class TursoBridge {
  private tableName: string = '';
  private queries: string[] = [];
  private params: any[] = [];
  private limitCount: number | null = null;
  private orderCol: string | null = null;
  private orderDir: 'ASC' | 'DESC' = 'ASC';
  
  // Dynamic Connection State
  private static storeDbUrl: string | null = null;
  private static storeDbToken: string | null = null;
  private static initializedStores = new Set<string>();
  private static initializationPromises = new Map<string, Promise<void>>();

  static connectToStore(url: string, token: string) {
      TursoBridge.storeDbUrl = url;
      TursoBridge.storeDbToken = token;
      console.log("Conectado ao banco da loja:", url);

      // Trigger schema check for this new connection
      // Always trigger check to ensure migrations run even if previously initialized in this session
      // (in case of page reload or re-connection)
      if (!TursoBridge.initializationPromises.has(url)) {
          const instance = new TursoBridge();
          TursoBridge.initializationPromises.set(url, instance.ensureStoreSchema(url, token));
      }
      
      // We don't await here to avoid blocking the UI, but we log success/failure
      TursoBridge.initializationPromises.get(url)?.then(() => {
          TursoBridge.initializedStores.add(url);
          TursoBridge.initializationPromises.delete(url);
          console.log("Schema da loja inicializado com sucesso");
      }).catch(err => {
          console.error("Falha ao inicializar schema da loja:", err);
          TursoBridge.initializationPromises.delete(url);
      });
  }

  static disconnectStore() {
      TursoBridge.storeDbUrl = null;
      TursoBridge.storeDbToken = null;
      console.log("Desconectado do banco da loja (usando principal)");
  }

  private async ensureStoreSchema(url: string, token: string) {
      console.log("Iniciando verificação de schema para:", url);
      try {
          for (const statement of SCHEMA_STATEMENTS) {
              // Skip store_profiles for store DBs as it lives in Main DB
              if (statement.includes('CREATE TABLE IF NOT EXISTS store_profiles')) continue;
              
              await this.executeSqlCustom(url, token, statement);
          }

          // Store DB Migrations
          try {
            const ordersTableInfo = await this.executeSqlCustom(url, token, `PRAGMA table_info(orders)`);
            const orderColumns = ordersTableInfo.rows.map((row: any) => row.name);
            
            if (!orderColumns.includes('deliveryDriverId')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE orders ADD COLUMN deliveryDriverId TEXT`); } catch (e) { console.warn(e); }
            }
            if (!orderColumns.includes('paymentDetails')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE orders ADD COLUMN paymentDetails TEXT`); } catch (e) { console.warn(e); }
            }
            if (!orderColumns.includes('isSynced')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE orders ADD COLUMN isSynced INTEGER DEFAULT 0`); } catch (e) { console.warn(e); }
            }
            if (!orderColumns.includes('session_id')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE orders ADD COLUMN session_id TEXT`); } catch (e) { console.warn(e); }
            }
            if (!orderColumns.includes('stockDeducted')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE orders ADD COLUMN stockDeducted INTEGER DEFAULT 1`); } catch (e) { console.warn(e); }
            }
            if (!orderColumns.includes('referencePoint')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE orders ADD COLUMN referencePoint TEXT`); } catch (e) { console.warn(e); }
            }
            if (!orderColumns.includes('originAddress')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE orders ADD COLUMN originAddress TEXT`); } catch (e) { console.warn(e); }
            }
            if (!orderColumns.includes('displayId')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE orders ADD COLUMN displayId TEXT`); } catch (e) { console.warn(e); }
            }
            if (!orderColumns.includes('customerId')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE orders ADD COLUMN customerId TEXT`); } catch (e) { console.warn(e); }
            }
            if (!orderColumns.includes('deliveryFee')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE orders ADD COLUMN deliveryFee REAL`); } catch (e) { console.warn(e); }
            }
            if (!orderColumns.includes('serviceFee')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE orders ADD COLUMN serviceFee REAL`); } catch (e) { console.warn(e); }
            }

            const productsTableInfo = await this.executeSqlCustom(url, token, `PRAGMA table_info(products)`);
            const productColumns = productsTableInfo.rows.map((row: any) => row.name);
            
            if (!productColumns.includes('stock')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE products ADD COLUMN stock REAL`); } catch (e) { console.warn(e); }
            }
            if (!productColumns.includes('showInMenu')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE products ADD COLUMN showInMenu INTEGER DEFAULT 1`); } catch (e) { console.warn(e); }
            }
            if (!productColumns.includes('fractions')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE products ADD COLUMN fractions INTEGER`); } catch (e) { console.warn(e); }
            }
            if (!productColumns.includes('units')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE products ADD COLUMN units INTEGER`); } catch (e) { console.warn(e); }
            }
            if (!productColumns.includes('fractionPrice')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE products ADD COLUMN fractionPrice REAL`); } catch (e) { console.warn(e); }
            }
            if (!productColumns.includes('ncm')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE products ADD COLUMN ncm TEXT`); } catch (e) { console.warn(e); }
            }
            if (!productColumns.includes('cfop')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE products ADD COLUMN cfop TEXT`); } catch (e) { console.warn(e); }
            }
            if (!productColumns.includes('icms_situacao_tributaria')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE products ADD COLUMN icms_situacao_tributaria TEXT`); } catch (e) { console.warn(e); }
            }

            const cashMovementsTableInfo = await this.executeSqlCustom(url, token, `PRAGMA table_info(cash_movements)`);
            const cashMovementsColumns = cashMovementsTableInfo.rows.map((row: any) => row.name);
            
            if (!cashMovementsColumns.includes('session_id')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE cash_movements ADD COLUMN session_id TEXT`); } catch (e) { console.warn(e); }
            }
            
            const waitstaffTableInfo = await this.executeSqlCustom(url, token, `PRAGMA table_info(waitstaff)`);
            const waitstaffColumns = waitstaffTableInfo.rows.map((row: any) => row.name);
            
            if (!waitstaffColumns.includes('phone')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE waitstaff ADD COLUMN phone TEXT`); } catch (e) { console.warn(e); }
            }

            const customersTableInfo = await this.executeSqlCustom(url, token, `PRAGMA table_info(customers)`);
            const customerColumns = customersTableInfo.rows.map((row: any) => row.name);

            if (!customerColumns.includes('cpf')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE customers ADD COLUMN cpf TEXT`); } catch (e) { console.warn(e); }
            }
            if (!customerColumns.includes('address')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE customers ADD COLUMN address TEXT`); } catch (e) { console.warn(e); }
            }
            if (!customerColumns.includes('referencePoint')) {
                try { await this.executeSqlCustom(url, token, `ALTER TABLE customers ADD COLUMN referencePoint TEXT`); } catch (e) { console.warn(e); }
            }
          } catch (e) {
             console.warn("Store Migration check failed:", e);
          }

          console.log("Schema verificado na loja:", url);
      } catch (err) {
          console.error("Erro ao criar schema na loja:", err);
          throw err;
      }
  }

  from(table: string) {
    const instance = new TursoBridge();
    instance.tableName = table;
    return instance;
  }
  
  // ... (rest of methods)

  private async executeQuery(sql: string, args: any[]) {
      // Determine which DB to use
      // store_profiles ALWAYS goes to Main DB
      const useStoreDb = TursoBridge.storeDbUrl && TursoBridge.storeDbToken && this.tableName !== 'store_profiles';
      
      const targetUrl = useStoreDb ? TursoBridge.storeDbUrl! : getTursoUrl();
      const targetToken = useStoreDb ? TursoBridge.storeDbToken! : getTursoAuthToken();

      // Ensure schema if connecting to a store DB for the first time
      if (useStoreDb && !TursoBridge.initializedStores.has(targetUrl)) {
          if (!TursoBridge.initializationPromises.has(targetUrl)) {
              TursoBridge.initializationPromises.set(targetUrl, this.ensureStoreSchema(targetUrl, targetToken));
          }
          try {
              await TursoBridge.initializationPromises.get(targetUrl);
              TursoBridge.initializedStores.add(targetUrl);
          } catch (e) {
              console.error("Falha na inicialização do schema da loja", e);
          } finally {
              TursoBridge.initializationPromises.delete(targetUrl);
          }
      }

      // We need to use a custom executeSql that accepts URL/Token
      return this.executeSqlCustom(targetUrl, targetToken, sql, args);
  }

  private async executeSqlCustom(url: string, token: string, sql: string, args: any[] = []) {
      if (!url) {
          console.error("Turso Error: URL is missing");
          throw new Error("Database URL is missing");
      }

      // Ensure URL uses https:// instead of libsql:// for fetch compatibility
      let httpUrl = url.trim();
      if (httpUrl.startsWith('libsql://')) {
          httpUrl = httpUrl.replace(/^libsql:\/\//, 'https://');
      } else if (!httpUrl.startsWith('http://') && !httpUrl.startsWith('https://')) {
          httpUrl = 'https://' + httpUrl;
      }
      
      // Remove trailing slash if present
      httpUrl = httpUrl.replace(/\/$/, '');

      const cleanToken = token ? token.trim() : '';

      // Sanitize args for SQLite
      const sanitizedArgs = args.map(arg => {
        if (typeof arg === 'boolean') return arg ? 1 : 0;
        return arg;
      });
    
      try {
        const response = await fetch(httpUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            statements: [
              {
                q: sql,
                params: sanitizedArgs
              }
            ]
          })
        });
    
        if (!response.ok) {
          const text = await response.text();
          console.error(`Turso HTTP Error: ${response.status} ${response.statusText} - ${text}`);
          throw new Error(`Turso HTTP Error ${response.status}: ${text}`);
        }
    
        const json = await response.json();
        
        if (!Array.isArray(json)) {
            console.error("Turso Error: Invalid response format", json);
            throw new Error("Invalid response format from Turso");
        }
    
        const result = json[0];
        if (result.error) {
            const errorMessage = typeof result.error === 'string' ? result.error : (result.error.message || JSON.stringify(result.error));
            console.error("Turso Query Error:", errorMessage, result);
            throw new Error(errorMessage);
        }
    
        if (!result.results) return { rows: [] };
    
        const { columns, rows } = result.results;
        if (!rows || !columns) return { rows: [] };
    
        const mappedRows = rows.map((row: any[]) => {
          const obj: any = {};
          columns.forEach((col: string, index: number) => {
            obj[col] = row[index];
          });
          return obj;
        });
    
        return { rows: mappedRows };
    
      } catch (err: any) {
        console.error("Turso Execute Error Details:", {
            url: httpUrl,
            message: err.message,
            stack: err.stack
        });
        if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
            throw new Error(`Falha de conexão com o banco de dados (${httpUrl}). Verifique a URL e sua conexão com a internet.`);
        }
        throw err;
      }
  }

  select(columns: string = '*') {
    return this;
  }

  is(column: string, value: null) {
    if (value === null) {
      this.queries.push(`${column} IS NULL`);
    } else {
      this.queries.push(`${column} IS ?`);
      this.params.push(value);
    }
    return this;
  }

  eq(column: string, value: any) {
    if (value === undefined || value === null) return this;
    this.queries.push(`${column} = ?`);
    this.params.push(value);
    return this;
  }

  neq(column: string, value: any) {
    if (value === undefined || value === null) return this;
    this.queries.push(`${column} != ?`);
    this.params.push(value);
    return this;
  }

  gte(column: string, value: any) {
    if (value === undefined || value === null) return this;
    this.queries.push(`${column} >= ?`);
    this.params.push(value);
    return this;
  }

  lte(column: string, value: any) {
    if (value === undefined || value === null) return this;
    this.queries.push(`${column} <= ?`);
    this.params.push(value);
    return this;
  }

  gt(column: string, value: any) {
    if (value === undefined || value === null) return this;
    this.queries.push(`${column} > ?`);
    this.params.push(value);
    return this;
  }

  lt(column: string, value: any) {
    if (value === undefined || value === null) return this;
    this.queries.push(`${column} < ?`);
    this.params.push(value);
    return this;
  }

  in(column: string, values: any[]) {
    if (!values || values.length === 0) return this;
    const placeholders = values.map(() => '?').join(', ');
    this.queries.push(`${column} IN (${placeholders})`);
    this.params.push(...values);
    return this;
  }

  order(column: string, config: { ascending: boolean } = { ascending: true }) {
    this.orderCol = column;
    this.orderDir = config.ascending ? 'ASC' : 'DESC';
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      // Only ensure schema on Main DB or if we are on Main DB
      // If we are on Store DB, we assume schema exists or we should ensure it there too?
      // For now, let's just ensure schema on Main DB to be safe for store_profiles
      if (this.tableName === 'store_profiles') {
          await ensureSchema();
      }
      return this.get().then(onfulfilled, onrejected);
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  async maybeSingle() {
    if (this.tableName === 'store_profiles') await ensureSchema();
    const { data } = await this.get();
    return { data: data && data.length > 0 ? data[0] : null, error: null };
  }

  private async get() {
    try {
      let queryStr = `SELECT * FROM ${this.tableName}`;
      if (this.queries.length > 0) {
        queryStr += ` WHERE ${this.queries.join(' AND ')}`;
      }
      if (this.orderCol) {
        queryStr += ` ORDER BY ${this.orderCol} ${this.orderDir}`;
      }
      if (this.limitCount) {
        queryStr += ` LIMIT ${this.limitCount}`;
      }
      
      const result = await this.executeQuery(queryStr, this.params);
      
      // Parse JSON columns and boolean integers
      const rows = result.rows.map(row => {
        const processedRow: any = { ...row };
        
        if (this.tableName === 'store_profiles' && typeof processedRow.settings === 'string') {
          try { processedRow.settings = JSON.parse(processedRow.settings); } catch (e) {}
        }
        if (this.tableName === 'orders' && typeof processedRow.items === 'string') {
          try { processedRow.items = JSON.parse(processedRow.items); } catch (e) {}
        }

        if (this.tableName === 'store_profiles') {
             processedRow.isActive = Boolean(processedRow.isActive);
        }
        if (this.tableName === 'products') {
             processedRow.isActive = Boolean(processedRow.isActive);
             processedRow.isByWeight = Boolean(processedRow.isByWeight);
             processedRow.showInMenu = Boolean(processedRow.showInMenu ?? 1);
        }
        if (this.tableName === 'orders') {
             processedRow.isSynced = Boolean(processedRow.isSynced);
             processedRow.stockDeducted = Boolean(processedRow.stockDeducted ?? 1);
        }
        if (this.tableName === 'customers') {
             processedRow.isLoyaltyParticipant = Boolean(processedRow.isLoyaltyParticipant ?? 1);
        }

        return processedRow;
      });

      return { data: rows, error: null };
    } catch (err: any) {
      console.error("Turso Get Error:", err);
      return { data: null, error: err };
    }
  }

  async insert(values: any[]) {
    if (this.tableName === 'store_profiles') await ensureSchema();
    try {
      const results = [];
      for (const val of values) {
        const valCopy = { ...val };

        if (!valCopy.id && (this.tableName === 'store_profiles' || this.tableName === 'waitstaff' || this.tableName === 'products')) {
             valCopy.id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
        }

        if (this.tableName === 'store_profiles' && valCopy.settings && typeof valCopy.settings === 'object') {
             valCopy.settings = JSON.stringify(valCopy.settings);
        }
        if (this.tableName === 'orders' && valCopy.items && typeof valCopy.items === 'object') {
             valCopy.items = JSON.stringify(valCopy.items);
        }

        if (typeof valCopy.isActive === 'boolean') valCopy.isActive = valCopy.isActive ? 1 : 0;
        if (typeof valCopy.isByWeight === 'boolean') valCopy.isByWeight = valCopy.isByWeight ? 1 : 0;
        if (typeof valCopy.isSynced === 'boolean') valCopy.isSynced = valCopy.isSynced ? 1 : 0;
        if (typeof valCopy.stockDeducted === 'boolean') valCopy.stockDeducted = valCopy.stockDeducted ? 1 : 0;

        const keys = Object.keys(valCopy);
        const placeholders = keys.map(() => `?`).join(', ');
        const columns = keys.join(', ');
        const queryStr = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`;
        
        const res = await this.executeQuery(queryStr, Object.values(valCopy));
        
        if (res.rows.length > 0) {
             const row = res.rows[0] as any;
             if (this.tableName === 'store_profiles' && typeof row.settings === 'string') {
                  try { row.settings = JSON.parse(row.settings); } catch (e) {}
             }
             if (this.tableName === 'orders' && typeof row.items === 'string') {
                  try { row.items = JSON.parse(row.items); } catch (e) {}
             }
             if (this.tableName === 'store_profiles') row.isActive = Boolean(row.isActive);
             if (this.tableName === 'products') {
                  row.isActive = Boolean(row.isActive);
                  row.isByWeight = Boolean(row.isByWeight);
                  row.showInMenu = Boolean(row.showInMenu ?? 1);
             }
             if (this.tableName === 'orders') {
                  row.isSynced = Boolean(row.isSynced);
                  row.stockDeducted = Boolean(row.stockDeducted ?? 1);
             }
             if (this.tableName === 'customers') {
                  row.isLoyaltyParticipant = Boolean(row.isLoyaltyParticipant ?? 1);
             }
             results.push(row);
        } else {
             results.push(val);
        }
      }
      return { data: results, error: null };
    } catch (err: any) {
      console.error("Turso Insert Error:", err);
      return { data: null, error: err };
    }
  }

  async upsert(values: any[]) {
    if (this.tableName === 'store_profiles') await ensureSchema();
    try {
        const results = [];
        for (const val of values) {
            const id = val.id;
            if (id) {
                const existing = await this.from(this.tableName).eq('id', id).maybeSingle();
                if (existing.data) {
                    const updated = await this.from(this.tableName).eq('id', id).update(val);
                    if (updated.error) throw updated.error;
                    if (updated.data && updated.data.length > 0) {
                        results.push(updated.data[0]);
                    } else {
                        results.push(val);
                    }
                    continue;
                }
            }
            const inserted = await this.insert([val]);
            if (inserted.error) throw inserted.error;
            if (inserted.data && inserted.data.length > 0) {
                results.push(inserted.data[0]);
            } else {
                results.push(val);
            }
        }
        return { data: results, error: null };
    } catch (err: any) {
        return { data: null, error: err };
    }
  }

  async update(values: any) {
    if (this.tableName === 'store_profiles') await ensureSchema();
    try {
      const valCopy = { ...values };
      
      if (this.tableName === 'store_profiles' && valCopy.settings && typeof valCopy.settings === 'object') {
           valCopy.settings = JSON.stringify(valCopy.settings);
      }
      if (this.tableName === 'orders' && valCopy.items && typeof valCopy.items === 'object') {
           valCopy.items = JSON.stringify(valCopy.items);
      }

      if (typeof valCopy.isActive === 'boolean') valCopy.isActive = valCopy.isActive ? 1 : 0;
      if (typeof valCopy.isByWeight === 'boolean') valCopy.isByWeight = valCopy.isByWeight ? 1 : 0;
      if (typeof valCopy.showInMenu === 'boolean') valCopy.showInMenu = valCopy.showInMenu ? 1 : 0;
      if (typeof valCopy.isSynced === 'boolean') valCopy.isSynced = valCopy.isSynced ? 1 : 0;
      if (typeof valCopy.stockDeducted === 'boolean') valCopy.stockDeducted = valCopy.stockDeducted ? 1 : 0;

      const keys = Object.keys(valCopy);
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      let queryStr = `UPDATE ${this.tableName} SET ${setClause}`;
      
      const args = [...Object.values(valCopy)];

      if (this.queries.length > 0) {
        queryStr += ` WHERE ${this.queries.join(' AND ')}`;
        args.push(...this.params);
      }
      
      queryStr += ` RETURNING *`;
      const result = await this.executeQuery(queryStr, args);
      
      const rows = result.rows.map(row => {
          const processedRow: any = { ...row };
          if (this.tableName === 'store_profiles' && typeof processedRow.settings === 'string') {
               try { processedRow.settings = JSON.parse(processedRow.settings); } catch (e) {}
          }
          if (this.tableName === 'orders' && typeof processedRow.items === 'string') {
               try { processedRow.items = JSON.parse(processedRow.items); } catch (e) {}
          }
          if (this.tableName === 'store_profiles') processedRow.isActive = Boolean(processedRow.isActive);
          if (this.tableName === 'products') {
               processedRow.isActive = Boolean(processedRow.isActive);
               processedRow.isByWeight = Boolean(processedRow.isByWeight);
               processedRow.showInMenu = Boolean(processedRow.showInMenu ?? 1);
          }
          if (this.tableName === 'orders') {
               processedRow.isSynced = Boolean(processedRow.isSynced);
               processedRow.stockDeducted = Boolean(processedRow.stockDeducted ?? 1);
          }
          if (this.tableName === 'customers') {
               processedRow.isLoyaltyParticipant = Boolean(processedRow.isLoyaltyParticipant ?? 1);
          }
          return processedRow;
      });

      return { data: rows, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async delete() {
    if (this.tableName === 'store_profiles') await ensureSchema();
    try {
      let queryStr = `DELETE FROM ${this.tableName}`;
      if (this.queries.length > 0) {
        queryStr += ` WHERE ${this.queries.join(' AND ')}`;
      }
      const result = await this.executeQuery(queryStr, this.params);
      return { data: result.rows, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  auth = {
    getSession: async () => ({ data: { session: null } }),
    signInWithPassword: async ({ email, password, store_id }: any) => {
      // Auth should check the Store DB if connected, or Main DB?
      // Usually auth is per store.
      // The executeQuery logic handles this (waitstaff table -> Store DB).
      
      let query = `SELECT * FROM waitstaff WHERE name = ? AND password = ?`;
      let params = [email, password];
      
      if (store_id) {
        query += ` AND store_id = ?`;
        params.push(store_id);
      }
      
      query += ` LIMIT 1`;
      
      // We need to use executeQuery here to respect the store connection
      // But auth is a property, not a method on the instance.
      // We need to access the static state or create an instance.
      // Let's create a temp instance to use executeQuery
      const tempInstance = new TursoBridge();
      tempInstance.tableName = 'waitstaff'; 
      const res = await tempInstance.executeQuery(query, params);

      if (res.rows.length > 0) {
        const user = res.rows[0] as any;
        return { 
          data: { 
            user: { 
              id: user.id, 
              email: user.name,
              role: user.role,
              store_id: user.store_id
            } 
          }, 
          error: null 
        };
      }
      return { data: { user: null }, error: { message: 'Credenciais inválidas' } };
    },
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  };

  // Backup and Restore Functions
  async backupDatabase(storeId?: string) {
      // Backup should respect the current connection
      // If connected to a store DB, backup that DB.
      // If on Main DB, backup Main DB.
      
      // If storeId is provided, we filter by it.
      
      try {
          const tables = ['store_profiles', 'categories', 'products', 'waitstaff', 'orders'];
          const backupData: any = {};

          for (const table of tables) {
              // Skip store_profiles if we are on a Store DB (it shouldn't be there usually, or it's a replica)
              // But for simplicity, let's try to select from all.
              
              let query = `SELECT * FROM ${table}`;
              const params = [];
              
              if (storeId) {
                  if (table === 'store_profiles') {
                      query += ` WHERE id = ?`;
                      params.push(storeId);
                  } else {
                      query += ` WHERE store_id = ?`;
                      params.push(storeId);
                  }
              }
              
              const tempInstance = new TursoBridge();
              tempInstance.tableName = table;
              const result = await tempInstance.executeQuery(query, params);
              backupData[table] = result.rows;
          }

          return { data: JSON.stringify(backupData), error: null };
      } catch (err: any) {
          return { data: null, error: err };
      }
  }

  private async executeBatch(statements: { q: string, params: any[] }[]) {
      const useStoreDb = TursoBridge.storeDbUrl && TursoBridge.storeDbToken && this.tableName !== 'store_profiles';
      
      const targetUrl = useStoreDb ? TursoBridge.storeDbUrl! : getTursoUrl();
      const targetToken = useStoreDb ? TursoBridge.storeDbToken! : getTursoAuthToken();

      // Ensure schema if connecting to a store DB for the first time
      if (useStoreDb && !TursoBridge.initializedStores.has(targetUrl)) {
          if (!TursoBridge.initializationPromises.has(targetUrl)) {
              TursoBridge.initializationPromises.set(targetUrl, this.ensureStoreSchema(targetUrl, targetToken));
          }
          try {
              await TursoBridge.initializationPromises.get(targetUrl);
              TursoBridge.initializedStores.add(targetUrl);
          } catch (e) {
              console.error("Falha na inicialização do schema da loja", e);
          } finally {
              TursoBridge.initializationPromises.delete(targetUrl);
          }
      }

      // Ensure URL uses https:// instead of libsql://
      let httpUrl = targetUrl.trim();
      if (httpUrl.startsWith('libsql://')) {
          httpUrl = httpUrl.replace(/^libsql:\/\//, 'https://');
      } else if (!httpUrl.startsWith('http://') && !httpUrl.startsWith('https://')) {
          httpUrl = 'https://' + httpUrl;
      }
      httpUrl = httpUrl.replace(/\/$/, '');
      const cleanToken = targetToken ? targetToken.trim() : '';

      // Sanitize args for SQLite
      const sanitizedStatements = statements.map(s => ({
          q: s.q,
          params: s.params.map(arg => {
            if (typeof arg === 'boolean') return arg ? 1 : 0;
            return arg;
          })
      }));

      try {
        const response = await fetch(httpUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            statements: sanitizedStatements
          })
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`Turso Batch HTTP Error: ${response.status} ${text}`);
          throw new Error(`Turso HTTP Error ${response.status}: ${text}`);
        }

        const json = await response.json();
        if (!Array.isArray(json)) throw new Error("Invalid response format");
        
        // Check for errors in any result
        for (const result of json) {
            if (result.error) {
                const errorMessage = typeof result.error === 'string' ? result.error : (result.error.message || JSON.stringify(result.error));
                throw new Error(errorMessage);
            }
        }

        return { success: true };
      } catch (err: any) {
        console.error("Turso Batch Execute Error:", err);
        if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
            throw new Error(`Falha de conexão com o banco de dados (${httpUrl}). Verifique a URL e sua conexão com a internet.`);
        }
        throw err;
      }
  }

  async restoreDatabase(backupJson: string, storeId?: string) {
      try {
          const backupData = JSON.parse(backupJson);
          const tables = ['store_profiles', 'categories', 'products', 'waitstaff', 'orders'];

          for (const table of tables) {
              if (backupData[table] && backupData[table].length > 0) {
                  // 1. Delete existing data
                  let deleteQuery = `DELETE FROM ${table}`;
                  const deleteParams = [];
                  
                  if (storeId) {
                      if (table === 'store_profiles') {
                          deleteQuery += ` WHERE id = ?`;
                          deleteParams.push(storeId);
                      } else {
                          deleteQuery += ` WHERE store_id = ?`;
                          deleteParams.push(storeId);
                      }
                  }
                  
                  const tempInstance = new TursoBridge();
                  tempInstance.tableName = table;
                  await tempInstance.executeQuery(deleteQuery, deleteParams);
                  
                  // 2. Batch Insert
                  const rows = backupData[table];
                  const CHUNK_SIZE = 50; // Turso might have limits on statements per request

                  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                      const chunk = rows.slice(i, i + CHUNK_SIZE);
                      const statements = chunk.map((row: any) => {
                          // Prepare row data
                          const rowCopy = { ...row };
                          
                          // Stringify JSON fields
                          if (table === 'store_profiles' && rowCopy.settings && typeof rowCopy.settings === 'object') {
                              rowCopy.settings = JSON.stringify(rowCopy.settings);
                          }
                          if (table === 'orders' && rowCopy.items && typeof rowCopy.items === 'object') {
                              rowCopy.items = JSON.stringify(rowCopy.items);
                          }

                          // Ensure Booleans are 0/1 (though executeBatch handles boolean type, JSON.parse gives boolean)
                          if (typeof rowCopy.isActive === 'boolean') rowCopy.isActive = rowCopy.isActive ? 1 : 0;
                          if (typeof rowCopy.isByWeight === 'boolean') rowCopy.isByWeight = rowCopy.isByWeight ? 1 : 0;

                          const keys = Object.keys(rowCopy);
                          const placeholders = keys.map(() => '?').join(', ');
                          const columns = keys.join(', ');
                          const values = Object.values(rowCopy);

                          return {
                              q: `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
                              params: values
                          };
                      });

                      await tempInstance.executeBatch(statements);
                  }
              }
          }
          return { success: true, error: null };
      } catch (err: any) {
          console.error("Restore Error:", err);
          return { success: false, error: err };
      }
  }

  // Helper to connect
  connectToStore(url: string, token: string) {
      TursoBridge.connectToStore(url, token);
  }
  
  disconnectStore() {
      TursoBridge.disconnectStore();
  }

  async cleanupOldCashHistory(storeId: string, days: number = 40) {
      if (!storeId) return;
      try {
          const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
          
          // Delete old cash movements
          const tempInstance1 = new TursoBridge();
          tempInstance1.tableName = 'cash_movements';
          await tempInstance1.executeQuery(
              `DELETE FROM cash_movements WHERE store_id = ? AND createdAt < ?`,
              [storeId, cutoffTime]
          );

          // Delete old register sessions
          const tempInstance2 = new TursoBridge();
          tempInstance2.tableName = 'register_sessions';
          await tempInstance2.executeQuery(
              `DELETE FROM register_sessions WHERE store_id = ? AND opened_at < ?`,
              [storeId, cutoffTime]
          );
          
          console.log(`Cleaned up cash history older than ${days} days.`);
      } catch (err) {
          console.error("Error cleaning up cash history:", err);
      }
  }
}

export const supabase = new TursoBridge();
