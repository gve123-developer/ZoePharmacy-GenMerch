import { useState, useEffect } from 'react';
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
import { LogOut, LayoutDashboard, Package, ShoppingCart, Receipt, BarChart3, Users, Menu, X, Calendar, ChevronLeft, ChevronRight, TrendingUp, ClipboardList } from 'lucide-react';
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
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    cost: number;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [poCurrentPage, setPoCurrentPage] = useState(1);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // On larger screens, default sidebar to open
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
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

        if (!productsRes.ok || !transactionsRes.ok) {
          throw new Error('Database connection failed');
        }

        const productsData = await productsRes.json();
        const transactionsData = await transactionsRes.json();

        // 🟢 SAVE TO CACHE FOR OFFLINE ACCESS
        localStorage.setItem('cachedProducts', JSON.stringify(productsData));
        localStorage.setItem('cachedTransactions', JSON.stringify(transactionsData));

        setProducts(productsData);
        setTransactions(transactionsData);
      } catch (error) {
        console.error("Error fetching data, falling back to cache:", error);
        const cachedProducts = localStorage.getItem('cachedProducts');
        const cachedTransactions = localStorage.getItem('cachedTransactions');
        if (cachedProducts) {
          setProducts(JSON.parse(cachedProducts));
        }
        if (cachedTransactions) {
          setTransactions(JSON.parse(cachedTransactions));
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 1000); // Retry every 1 second
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

  const purchaseOrderItems = products.map(p => ({
    ...p,
    forecast: getForecast(p, transactions, false)
  })).filter(p => p.forecast.reorderRecommendation > 0);

  const lowStockProducts = purchaseOrderItems; // Re-use the list for reports

  const downloadPDF = (): void => {
    if (!currentUser) return;
    try {
      const doc = new jsPDF();
      let yPosition = 25;

      // Helper for structured layout
      const drawProductHeader = (y: number) => {
        doc.setFont('helvetica', 'bold');
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

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('Zoe Pharmacy & General Merchandise', 14, yPosition);
      yPosition += 8;

      doc.setFontSize(14);
      doc.text('PURCHASE ORDER REPORT', 14, yPosition);
      yPosition += 12;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPosition);
      yPosition += 15;

      if (lowStockProducts.length > 0) {
        yPosition = drawProductHeader(yPosition);
        doc.setFont('helvetica', 'normal');

        lowStockProducts.forEach((product) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 30;
            yPosition = drawProductHeader(yPosition);
            doc.setFont('helvetica', 'normal');
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
          doc.text(`P${product.cost.toFixed(2)}`, 182, yPosition);
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
        <LoginPage onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      <Toaster />

      {/* Header */}
      <ErrorBoundary fallbackTitle="Header Error">
        <header className="border-b border-gray-200 sticky top-0 z-30 flex-shrink-0" style={{ backgroundColor: '#d5ff47' }}>
          <div className="px-3 md:px-6 py-3 md:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="hover:bg-black/5 shrink-0"
                >
                  <Menu className="size-6" />
                </Button>
                <div className="min-w-0">
                  <h1 className="font-semibold text-xs sm:text-lg md:text-xl text-gray-900 uppercase truncate">Zoe Pharmacy & General Merchandise</h1>
                  <p className="text-[10px] sm:text-xs md:text-sm text-gray-500">Inventory & POS System</p>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-4 shrink-0">
                <div className="text-right">
                  <p className="font-bold text-xs md:text-lg text-gray-900 leading-tight">{currentUser.name}</p>
                  <p className="text-xs md:text-sm font-semibold text-gray-600 capitalize tracking-wide hidden sm:block">{currentUser.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>
      </ErrorBoundary>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <ErrorBoundary fallbackTitle="Sidebar Error">
          <aside
            className={`fixed md:relative top-0 left-0 h-full z-20 md:z-auto border-r border-gray-200 overflow-y-auto transition-all duration-300 ease-in-out flex-shrink-0
              ${isSidebarOpen ? 'w-64 translate-x-0 opacity-100' : 'w-0 -translate-x-full opacity-0 overflow-hidden'}
              md:top-auto
            `}
            style={{ backgroundColor: '#f1fec1' }}
          >
            <nav className="p-4 h-full flex flex-col">
              <div className="space-y-1">
                {([
                  { tab: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-[18px]" /> },
                  { tab: 'pos', label: 'Point of Sale', icon: <ShoppingCart className="size-[18px]" /> },
                  { tab: 'inventory', label: 'Inventory', icon: <Package className="size-[18px]" /> },
                  { tab: 'transactions', label: 'Transactions', icon: <Receipt className="size-[18px]" /> },
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
                      // Auto-close sidebar on mobile after selection
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === tab
                      ? 'text-gray-900 border-l-4 border-gray-800 shadow-md'
                      : 'text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 active:-translate-y-1'
                      }`}
                    style={activeTab === tab ? { backgroundColor: '#d5ff47' } : {}}
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
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${activeTab === 'users'
                    ? 'text-gray-900 border-l-4 border-gray-800 shadow-md'
                    : 'text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 active:-translate-y-1'
                    }`}
                  style={activeTab === 'users' ? { backgroundColor: '#d5ff47' } : {}}
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
        <main className="flex-1 p-3 md:p-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              currentUser={currentUser}
              products={products}
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
