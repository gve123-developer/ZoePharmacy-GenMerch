import { setupPdfPesoFont } from './utils/pdfFont';
import { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

import { LoginPage } from '@/app/components/LoginPage';
import { Dashboard } from '@/app/components/Dashboard';
import { InventoryManagement } from '@/app/components/InventoryManagement';
import { POSSystem } from '@/app/components/POSSystem';
import { TransactionHistory } from '@/app/components/TransactionHistory';
import { Reports } from '@/app/components/Reports';
import { ExpiryManagement } from '@/app/components/ExpiryManagement';
import { StockForecasting } from '@/app/components/StockForecasting';
import { UserManagement } from '@/app/components/UserManagement';
import { AuditLogs } from '@/app/components/AuditLogs';
import { NotFound } from '@/app/components/NotFound';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { Badge } from '@/app/components/ui/badge';
import { getForecast } from '@/app/utils/forecastingUtils';
import { Toaster } from '@/app/components/ui/sonner';
import { Button } from '@/app/components/ui/button';
import { LogOut, LayoutDashboard, Package, ShoppingCart, ReceiptText, BarChart3, Users, Menu, X, Calendar, ChevronLeft, ChevronRight, TrendingUp, ClipboardList } from 'lucide-react';
import { logAuditAction } from '@/app/utils/auditUtils';
import { installErrorLogger } from '@/app/utils/errorLogger';

export type UserRole = 'admin' | 'owner';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  email?: string;
  password?: string;
  lastLogin?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  quantity: number;
  price: number;
  cost: number;
  reorderLevel: number;
  expiryDate?: string;
  description?: string;
  newStockQuantity?: number;
  newStockExpiry?: string;
}

export interface Transaction {
  id: string;
  date: string;
  items: Array<{
    itemId?: number;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    cost: number;
    status?: string;
  }>;
  total: number;
  paymentMethod?: string;
  cashier?: string;
  amountReceived?: number;
  change?: number;
  status?: string;
}

export interface LossEntry {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  cost: number;
  totalLoss: number;
  date: string;
}

type Tab = 'dashboard' | 'inventory' | 'pos' | 'transactions' | 'reports' | 'users' | 'purchaseOrder' | 'expiry' | 'forecasting' | 'audit';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('cachedProducts');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [poCurrentPage, setPoCurrentPage] = useState(1);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const cached = localStorage.getItem('cachedTransactions');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // On desktop screens (>= 1024px), default sidebar to open
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsSidebarOpen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsSidebarOpen(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Install global JS error logger once on app load
  useEffect(() => {
    installErrorLogger(() => currentUser?.name);
  }, []);

  // Load persisted user + fetch data on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user.role !== 'admin' && user.role !== 'owner') {
        user.role = 'admin';
        localStorage.setItem('currentUser', JSON.stringify(user));
      }
      setCurrentUser(user);
    }

    const fetchData = async () => {
      try {
        const [productsRes, transactionsRes] = await Promise.all([
          fetch('/api/products.php'),
          fetch('/api/transactions.php')
        ]);

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          if (Array.isArray(productsData)) {
            setProducts(productsData);
            localStorage.setItem('cachedProducts', JSON.stringify(productsData));
          }
        }

        if (transactionsRes.ok) {
          const transactionsData = await transactionsRes.json();
          if (Array.isArray(transactionsData)) {
            setTransactions(transactionsData);
            localStorage.setItem('cachedTransactions', JSON.stringify(transactionsData));
          }
        }
      } catch (error) {
        console.error('Error syncing products/transactions:', error);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000); // Sync data every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const migrateCategories = (product: Product): Product => {
    const categoryMap: Record<string, string> = {
      'Medicine': 'Pharmaceutical',
      'Supplements': 'Non-pharmaceutical',
      'Personal Care': 'Non-pharmaceutical',
      'Medical Equipment': 'Non-pharmaceutical',
      'First Aid': 'Non-pharmaceutical',
      'General Merchandise': 'Non-pharmaceutical'
    };

    if (categoryMap[product.category]) {
      return { ...product, category: categoryMap[product.category] };
    }
    return product;
  };

  const addDefaultExpiry = (product: Product): Product => {
    if (!product.expiryDate) {
      // Add a default expiry date (e.g., 1 year from now)
      const date = new Date();
      date.setFullYear(date.getFullYear() + 1);
      return { ...product, expiryDate: date.toISOString().split('T')[0] };
    }
    return product;
  };

  const cleanProductNames = (product: Product): Product => {
    // Comprehensive list of prefixes and suffixes to strip
    const wordsToStrip = [
      'Expired', 'Old', 'Legacy', 'Past-due', 'Soon-to-Expire',
      'Feb-End', 'March-Early', 'Soon-to-expires', 'Expiring'
    ];

    let newName = product.name;

    wordsToStrip.forEach(word => {
      // Clean prefixes (case insensitive, with or without dash/space)
      const prefixRegex = new RegExp(`^${word}[\\s\\-]`, 'i');
      newName = newName.replace(prefixRegex, '');
    });

    newName = newName.trim();

    if (newName !== product.name && newName.length > 0) {
      return { ...product, name: newName };
    }
    return product;
  };

  const handleProductsChange = (updatedProducts: Product[]) => {
    setProducts(updatedProducts);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    // ✅ Audit: log logout event
    if (currentUser) {
      logAuditAction(currentUser.name, 'Logout', `User "${currentUser.username}" logged out.`);
    }
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setActiveTab('dashboard');
  };

  const purchaseOrderItems = useMemo(() => {
    return products.map(p => ({
      ...p,
      forecast: getForecast(p, transactions, false)
    })).filter(p => p.forecast.reorderRecommendation > 0);
  }, [products, transactions]);

  const lowStockProducts = purchaseOrderItems; // Re-use the list for reports

  const downloadPDF = async (): Promise<void> => {
    if (!currentUser) return;
    try {
      const doc = new jsPDF();
      await setupPdfPesoFont(doc);
      let yPosition = 25;

      // Helper for structured layout
      const drawProductHeader = (y: number) => {
        doc.setFont('NotoSans', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFillColor(245, 245, 245);
        doc.rect(14, y - 5, 182, 7, 'F');
        doc.setDrawColor(0, 0, 0);
        doc.rect(14, y - 5, 182, 7, 'S');
        doc.text('Product Name', 17, y);
        doc.text('SKU', 80, y);
        doc.text('Stock', 105, y);
        doc.text('Reorder level', 130, y);
        doc.text('Recommend Order', 155, y);
        doc.text('Unit Cost', 185, y);
        return y + 8;
      };

      doc.setFont('NotoSans', 'normal');
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('Zoe Pharmacy & General Merchandise', 14, yPosition);
      yPosition += 8;

      doc.setFontSize(14);
      doc.text('PURCHASE ORDER REPORT', 14, yPosition);
      yPosition += 12;

      doc.setFont('NotoSans', 'normal');
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPosition);
      yPosition += 15;

      if (lowStockProducts.length > 0) {
        yPosition = drawProductHeader(yPosition);
        doc.setFont('NotoSans', 'normal');

        lowStockProducts.forEach((product) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 30;
            yPosition = drawProductHeader(yPosition);
            doc.setFont('NotoSans', 'normal');
          }

          doc.setDrawColor(0, 0, 0);
          doc.rect(14, yPosition - 5, 182, 8);
          doc.line(75, yPosition - 5, 75, yPosition + 3);
          doc.line(100, yPosition - 5, 100, yPosition + 3);
          doc.line(125, yPosition - 5, 125, yPosition + 3);
          doc.line(155, yPosition - 5, 155, yPosition + 3);
          doc.line(180, yPosition - 5, 180, yPosition + 3);

          doc.setTextColor(0, 0, 0);
          doc.text(product.name.substring(0, 25), 17, yPosition);
          doc.text(product.sku, 77, yPosition);
          doc.text(product.quantity.toString(), 102, yPosition);
          doc.text(product.reorderLevel.toString(), 127, yPosition);
          const recommendation = (product as any).forecast?.reorderRecommendation || 0;
          doc.text(recommendation.toString(), 157, yPosition);
          doc.text(`₱${product.cost.toFixed(2)}`, 182, yPosition);
          yPosition += 8;
        });
      } else {
        doc.text('No low stock products found.', 14, yPosition);
      }

      doc.save('purchase_order.pdf');
      logAuditAction(
        currentUser.name,
        'Purchase Order',
        `Downloaded Purchase Order PDF containing ${lowStockProducts.length} items`
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };




  if (!currentUser) {
    return (
      <ErrorBoundary fallbackTitle="Login Page Error">
        <Toaster position="top-right" />
        <LoginPage onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      <Toaster position="top-right" />

      {/* Header */}
      <ErrorBoundary fallbackTitle="Header Error">
        <header className="border-b border-emerald-600/30 sticky top-0 z-30 flex-shrink-0" style={{ backgroundColor: '#54b768' }}>
          <div className="px-3 md:px-6 py-3 md:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="text-white hover:bg-white/15 shrink-0"
                >
                  {isSidebarOpen ? <X className="size-6" /> : <Menu className="size-6" />}
                </Button>
                <div className="min-w-0">
                  <h1 className="font-bold text-xs sm:text-lg md:text-xl text-white uppercase truncate drop-shadow-sm">Zoe Pharmacy & General Merchandise</h1>
                  <p className="text-[10px] sm:text-xs md:text-sm text-emerald-100 font-medium">Inventory & POS System</p>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-4 shrink-0">
                <div className="text-right">
                  <p className="font-bold text-xs md:text-lg text-white leading-tight drop-shadow-sm">{currentUser.name}</p>
                  <p className="text-xs md:text-sm font-semibold text-emerald-100 capitalize tracking-wide hidden sm:block">{currentUser.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>
      </ErrorBoundary>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile & Tablet overlay backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <ErrorBoundary fallbackTitle="Sidebar Error">
          <aside
            className={`fixed lg:relative top-0 left-0 h-full z-50 lg:z-auto border-r border-gray-200 overflow-y-auto transition-all duration-300 ease-in-out flex-shrink-0 shadow-2xl lg:shadow-none
              ${isSidebarOpen ? 'w-72 sm:w-64 translate-x-0 opacity-100' : 'w-0 -translate-x-full opacity-0 pointer-events-none lg:pointer-events-auto overflow-hidden'}
            `}
            style={{ backgroundColor: '#eef8f0' }}
          >
            {/* Drawer Header for Mobile & Tablet */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200/80 bg-[#54b768] text-white lg:hidden">
              <div className="flex items-center gap-2.5">
                <img src="/logo.jpg" alt="Zoe Pharmacy" className="h-8 w-auto rounded-md shadow-sm" />
                <span className="font-bold text-sm uppercase tracking-wide">Menu</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(false)}
                className="text-white hover:bg-white/20 h-8 w-8 rounded-full"
              >
                <X className="size-5" />
              </Button>
            </div>

            <nav className="p-4 h-[calc(100%-60px)] lg:h-full flex flex-col">
              <div className="space-y-1">
                {([
                  { tab: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-[18px]" /> },
                  { tab: 'pos', label: 'Point of Sale', icon: <ShoppingCart className="size-[18px]" /> },
                  { tab: 'inventory', label: 'Inventory', icon: <Package className="size-[18px]" /> },
                  { tab: 'transactions', label: 'Transactions', icon: <ReceiptText className="size-[18px]" /> },
                  { tab: 'purchaseOrder', label: 'Purchase Order', icon: <ShoppingCart className="size-[18px]" /> },
                  { tab: 'expiry', label: 'Expiry Tracker', icon: <Calendar className="size-[18px]" /> },
                  { tab: 'reports', label: 'Reports', icon: <BarChart3 className="size-[18px]" /> },
                  { tab: 'forecasting', label: 'Forecasting', icon: <TrendingUp className="size-[18px]" /> },
                  { tab: 'audit', label: 'Audit Logs', icon: <ClipboardList className="size-[18px]" /> },
                ] as { tab: Tab; label: string; icon: React.ReactNode }[]).map(({ tab, label, icon }) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      // Auto-close sidebar on mobile/tablet after selection
                      if (window.innerWidth < 1024) setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === tab
                      ? 'text-white border-l-4 border-emerald-800 shadow-md'
                      : 'text-gray-700 hover:bg-emerald-100/60 hover:-translate-y-0.5 active:-translate-y-1'
                      }`}
                    style={activeTab === tab ? { backgroundColor: '#54b768' } : {}}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-auto pt-4 border-t border-black/5 space-y-1">
                <button
                  onClick={() => {
                    setActiveTab('users');
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${activeTab === 'users'
                    ? 'text-white border-l-4 border-emerald-800 shadow-md'
                    : 'text-gray-700 hover:bg-emerald-100/60 hover:-translate-y-0.5 active:-translate-y-1'
                    }`}
                  style={activeTab === 'users' ? { backgroundColor: '#54b768' } : {}}
                >
                  <Users className="size-[18px]" />
                  User Management
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-semibold text-red-600 hover:bg-red-50 transition-all duration-150 hover:-translate-y-0.5 active:-translate-y-1"
                >
                  <LogOut className="size-[18px]" />
                  Logout
                </button>
              </div>
            </nav>
          </aside>
        </ErrorBoundary>

        {/* Main Content */}
        <main className="flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              currentUser={currentUser}
              products={products}
              transactions={transactions}
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryManagement
              currentUser={currentUser}
              products={products}
              onProductsChange={handleProductsChange}
            />
          )}
          {activeTab === 'pos' && (
            <POSSystem
              currentUser={currentUser}
              products={products}
              onProductsChange={handleProductsChange}
              onTransactionComplete={(newTx) => {
                setTransactions(prev => [newTx, ...prev]);
                try {
                  const cached = localStorage.getItem('cachedTransactions');
                  const list = cached ? JSON.parse(cached) : [];
                  localStorage.setItem('cachedTransactions', JSON.stringify([newTx, ...list]));
                } catch (e) {}
              }}
            />
          )}
          {activeTab === 'transactions' && (
            <TransactionHistory currentUser={currentUser} />
          )}
          {activeTab === 'expiry' && (
            <ExpiryManagement
              currentUser={currentUser}
              products={products}
              onProductsChange={handleProductsChange}
            />
          )}
          {activeTab === 'reports' && (
            <ErrorBoundary fallbackTitle="Reports Error">
              <Reports currentUser={currentUser} />
            </ErrorBoundary>
          )}
          {activeTab === 'users' && (
            <UserManagement currentUser={currentUser} />
          )}
          {activeTab === 'forecasting' && (
            <StockForecasting products={products} transactions={transactions} />
          )}
          {activeTab === 'audit' && currentUser && (
            <AuditLogs currentUser={currentUser} />
          )}
          {activeTab === 'purchaseOrder' && (
            <ErrorBoundary fallbackTitle="Purchase Order Error">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Purchase Orders</h2>
                    <p className="text-sm text-gray-500 mt-1">Products with low stock that need to be purchased</p>
                  </div>
                  {lowStockProducts.length > 0 && (
                    <Button
                      onClick={downloadPDF}
                      className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
                    >
                      <span className="mr-2">📄</span>
                      Download
                    </Button>
                  )}
                </div>

                <div className="w-full bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 border text-left text-sm font-bold text-gray-700">Product Name</th>
                        <th className="px-6 py-3 border text-left text-sm font-bold text-gray-700">SKU</th>
                        <th className="px-6 py-3 border text-left text-sm font-bold text-gray-700">Current Stock</th>
                        <th className="px-6 py-3 border text-left text-sm font-bold text-gray-700">Reorder Level</th>
                        <th className="px-6 py-3 border text-left text-sm font-bold text-gray-700">Recommended Order</th>
                        <th className="px-6 py-3 border text-left text-sm font-bold text-gray-700">Cost Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {lowStockProducts.length > 0 ? (
                        lowStockProducts.slice((poCurrentPage - 1) * 15, poCurrentPage * 15).map(product => (
                          <tr key={product.id} className="hover:bg-gray-50 transition-colors even:bg-gray-50/50">
                            <td className="px-6 py-4 border text-sm text-gray-900">{product.name}</td>
                            <td className="px-6 py-4 border text-sm text-gray-600">{product.sku}</td>
                            <td className="px-6 py-4 border text-sm text-gray-600">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-900">{Number(product.quantity) + Number(product.newStockQuantity || 0)}</span>
                                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">Total Units</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 border text-sm text-gray-600">{product.reorderLevel}</td>
                            <td className="px-6 py-4 border text-sm text-blue-700 font-black">{(product as any).forecast?.reorderRecommendation || 0}</td>
                            <td className="px-6 py-4 border text-sm text-gray-900">₱{product.cost.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-6 py-4 text-center text-gray-500" colSpan={6}>
                            No products below reorder level
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {lowStockProducts.length > 0 && (() => {
                    const totalPages = Math.max(1, Math.ceil(lowStockProducts.length / 15));
                    return (
                      <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl">
                        <div className="text-sm text-gray-500 font-medium">
                          Showing <span className="text-gray-900 font-bold">{lowStockProducts.length === 0 ? 0 : ((poCurrentPage - 1) * 15) + 1}</span> to <span className="text-gray-900 font-bold">{Math.min(poCurrentPage * 15, lowStockProducts.length)}</span> of <span className="text-gray-900 font-bold">{lowStockProducts.length}</span> products
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPoCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={poCurrentPage === 1}
                            className="bg-white border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                          >
                            <ChevronLeft className="size-4 mr-1" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-1 hidden sm:flex">
                            {(() => {
                              const pages = [];
                              let start = Math.max(1, poCurrentPage - 1);
                              if (start + 2 > totalPages) start = Math.max(1, totalPages - 2);
                              let end = Math.min(totalPages, start + 2);

                              for (let i = start; i <= end; i++) {
                                pages.push(i);
                              }

                              return (
                                <>
                                  {start > 1 && <span className="text-gray-400 px-1">...</span>}
                                  {pages.map(page => (
                                    <Button
                                      key={page}
                                      variant={poCurrentPage === page ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setPoCurrentPage(page)}
                                      className={`size-8 p-0 font-bold ${poCurrentPage === page ? "bg-gray-900 text-white" : "bg-white border-gray-200"}`}
                                    >
                                      {page}
                                    </Button>
                                  ))}
                                  {end < totalPages && <span className="text-gray-400 px-1">...</span>}
                                </>
                              );
                            })()}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPoCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={poCurrentPage >= totalPages}
                            className="bg-white border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                          >
                            Next
                            <ChevronRight className="size-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;










