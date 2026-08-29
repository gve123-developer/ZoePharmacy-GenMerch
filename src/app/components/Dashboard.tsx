import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/app/components/ui/alert-dialog';
import { User, Product, Transaction } from '@/app/App';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Package, PhilippinePeso, TrendingUp, AlertTriangle, Calendar, ReceiptText, Plus, TrendingDown, CloudRain } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';

interface DashboardProps {
  currentUser: User;
  products: Product[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

import { speak, stopSpeaking } from '@/app/utils/voiceUtils';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-PH').format(value);
};

export function Dashboard({ currentUser, products }: DashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [showOutOfStockAlert, setShowOutOfStockAlert] = useState(false);
  const [timeRange, setTimeRange] = useState('today');
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [outOfStockProducts, setOutOfStockProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    todaySales: 0,
    todayProfit: 0,
    todayTransactionsCount: 0,
    expiringSoon: 0,
    totalUnits: 0,
  });

  // Track what we've already started speaking to prevent "stuttering" on refresh
  const spokenOOSRef = useRef<string | null>(null);
  const spokenLowRef = useRef<string | null>(null);

  const getFilterLabel = () => {
    switch (timeRange) {
      case 'today': return 'Today';
      case '7days': return 'Last 7 Days';
      case '30days': return 'Last 30 Days';
      case 'yearly': return 'Last 365 Days';
      case 'all': return 'All Time';
      default: return '';
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, [products, timeRange]);


  const loadData = async () => {
    // Load transactions from API
    let transactionsList: Transaction[] = [];
    try {
      const response = await fetch('/api/transactions.php');
      const data = await response.json();
      if (Array.isArray(data)) {
        transactionsList = data;
        setTransactions(data);
      }
    } catch (error) {
      console.error("Error loading dashboard transactions:", error);
    }

    // Check for stock issues (considering both old and new stock)
    const lowStockItems = products.filter(p => {
      const total = Number(p.quantity) + Number(p.newStockQuantity || 0);
      return total > 0 && total <= p.reorderLevel;
    });
    const outOfStockItems = products.filter(p => (Number(p.quantity) + Number(p.newStockQuantity || 0)) === 0);

    setLowStockProducts(lowStockItems);
    setOutOfStockProducts(outOfStockItems);

    // Manage alert triggers
    const outOfStockIds = outOfStockItems.map(p => p.id).sort().join(',');
    const lastOutOfStockIds = localStorage.getItem('lastSeenOutOfStockIds');
    const outOfStockDismissed = localStorage.getItem('outOfStockDismissed') === 'true';

    const lowStockIds = lowStockItems.map(p => p.id).sort().join(',');
    const lastLowStockIds = localStorage.getItem('lastSeenLowStockIds');
    const lowStockDismissed = localStorage.getItem('lowStockDismissed') === 'true';

    // Check Out of Stock first (High Priority)
    const shouldShowOOS = outOfStockItems.length > 0 && (!outOfStockDismissed || outOfStockIds !== lastOutOfStockIds);

    if (shouldShowOOS) {
      setShowOutOfStockAlert(true);
      setShowLowStockAlert(false);
      localStorage.removeItem('outOfStockDismissed');
      localStorage.setItem('lastSeenOutOfStockIds', outOfStockIds);

      // Only trigger speak if the IDs actually changed or if not already showing in this session
      if (outOfStockIds !== spokenOOSRef.current) {
        spokenOOSRef.current = outOfStockIds;
        speak([
          "Critical Alert!",
          "The following products are out of stock:",
          ...outOfStockItems.map(p => ({ text: p.name || 'Unknown Product', pause: 300 }))
        ], { loop: true });
      }
    } else {
      // If OOS is not showing, check Low Stock
      const shouldShowLow = lowStockItems.length > 0 && (!lowStockDismissed || lowStockIds !== lastLowStockIds);

      if (shouldShowLow) {
        setShowLowStockAlert(true);
        setShowOutOfStockAlert(false);
        localStorage.removeItem('lowStockDismissed');
        localStorage.setItem('lastSeenLowStockIds', lowStockIds);

        // Only trigger speak if the IDs actually changed or if not already showing
        if (lowStockIds !== spokenLowRef.current) {
          spokenLowRef.current = lowStockIds;
          speak([
            "Low Stock Alert.",
            "The following products are low on stock:",
            ...lowStockItems.map(p => ({ text: p.name || 'Unknown Product', pause: 300 }))
          ], { loop: true });
        }
      } else {
        // Reset Ref if lists are now empty (so they trigger again if items reappear)
        if (outOfStockItems.length === 0) {
          localStorage.removeItem('lastSeenOutOfStockIds');
          spokenOOSRef.current = null;
          // Only stop if we were actually showing this alert
          // (stopSpeaking is handles by Acknowledge button too)
        }
        if (lowStockItems.length === 0) {
          localStorage.removeItem('lastSeenLowStockIds');
          spokenLowRef.current = null;
        }
      }
    }

    // Calculate stats using selected time filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let cutoffDate = new Date(today);

    if (timeRange === '7days') {
      cutoffDate.setDate(today.getDate() - 7);
    } else if (timeRange === '30days') {
      cutoffDate.setDate(today.getDate() - 30);
    } else if (timeRange === 'yearly') {
      cutoffDate.setFullYear(today.getFullYear() - 1);
    }

    const filteredTransactions = transactionsList.filter((t: Transaction) => {
      // Completely ignore voided transactions in all sales logic
      if (t.status === 'voided') return false;

      const dateStr = t.date ? (t.date.includes('T') ? t.date : t.date.replace(' ', 'T')) : '';
      const d = new Date(dateStr);
      const txDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

      if (timeRange === 'all') return true;
      if (timeRange === 'today') return txDay.getTime() === today.getTime();
      return txDay >= cutoffDate;
    });

    const filteredSales = filteredTransactions.reduce((sum: number, t: Transaction) => sum + t.total, 0);

    // Calculate Filtered Profit
    let filteredProfit = 0;
    filteredTransactions.forEach((transaction: Transaction) => {
      transaction.items.forEach((item: any) => {
        const itemCostPrice = item.cost !== undefined ? item.cost : (products.find(p => p.id === item.productId)?.cost || 0);
        const itemRevenue = item.price * item.quantity;
        const itemCost = itemCostPrice * item.quantity;
        filteredProfit += (itemRevenue - itemCost);
      });
    });

    const expiringSoonItems = products.filter(p => {
      if (!p.expiryDate) return false;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const expiry = new Date(p.expiryDate);
      const diffTime = expiry.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    });

    const totalUnitsCount = products.reduce((sum, p) => sum + (Number(p.quantity) + Number(p.newStockQuantity || 0)), 0);

    setStats({
      totalProducts: products.length,
      lowStock: lowStockItems.length,
      outOfStock: outOfStockItems.length,
      todaySales: filteredSales,
      todayProfit: filteredProfit,
      todayTransactionsCount: filteredTransactions.length,
      expiringSoon: expiringSoonItems.length,
      totalUnits: totalUnitsCount,
    });
  };

  const getFilteredTransactions = () => {
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  // Only completed sales may affect analytics.
  const completedTransactions = transactions.filter(
    (t: Transaction) => t.status === 'completed'
  );

  if (timeRange === 'all') {
    return completedTransactions;
  }

  let cutoffDate = new Date(today);

  if (timeRange === '7days') {
    cutoffDate.setDate(today.getDate() - 7);
  } else if (timeRange === '30days') {
    cutoffDate.setDate(today.getDate() - 30);
  } else if (timeRange === 'yearly') {
    cutoffDate.setFullYear(today.getFullYear() - 1);
  }

  return completedTransactions.filter((t: Transaction) => {
    const txDate = new Date(t.date);

    const txDay = new Date(
      txDate.getFullYear(),
      txDate.getMonth(),
      txDate.getDate()
    );

    if (timeRange === 'today') {
      return txDay.getTime() === today.getTime();
    }

    return txDay >= cutoffDate;
  });
};
  const getSalesByCategory = () => {
    const filtered = getFilteredTransactions();
    const categorySales: Record<string, number> = {};

    filtered.forEach((transaction: Transaction) => {
      transaction.items.forEach((item: any) => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const category = product.category;
          categorySales[category] = (categorySales[category] || 0) + (item.quantity * item.price);
        }
      });
    });

    return Object.entries(categorySales).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  };

  const getSalesData = () => {
  const completedTransactions = transactions.filter(
    (t: Transaction) => t.status === 'completed'
  );

  // If "today", include yesterday + today so a line can still be drawn.
  let days =
    timeRange === '30days'
      ? 30
      : timeRange === 'today'
        ? 2
        : 7;

  if (timeRange === 'yearly') {
    days = 365;
  } else if (timeRange === 'all') {
    if (completedTransactions.length === 0) {
      days = 7;
    } else {
      const sorted = [...completedTransactions].sort(
        (a, b) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime()
      );

      const firstDate = new Date(sorted[0].date);
      firstDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      days =
        Math.ceil(
          (today.getTime() - firstDate.getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1;

      if (days < 2) {
        days = 2;
      }
    }
  }

  const data = [];

  // Group COMPLETED transactions only by local date.
  const txByDate = completedTransactions.reduce(
    (acc, t) => {
      const d = new Date(t.date);

      const key =
        `${d.getFullYear()}-` +
        `${String(d.getMonth() + 1).padStart(2, '0')}-` +
        `${String(d.getDate()).padStart(2, '0')}`;

      acc[key] = (acc[key] || 0) + Number(t.total || 0);

      return acc;
    },
    {} as Record<string, number>
  );

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);

    const dateKey =
      `${d.getFullYear()}-` +
      `${String(d.getMonth() + 1).padStart(2, '0')}-` +
      `${String(d.getDate()).padStart(2, '0')}`;

    data.push({
      date: d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      sales: txByDate[dateKey] || 0,
    });
  }

  return data;
};

  const getTopProducts = () => {
    const filtered = getFilteredTransactions();
    const productSales: Record<string, number> = {};

    filtered.forEach((transaction: Transaction) => {
      transaction.items.forEach((item: any) => {
        productSales[item.productName] = (productSales[item.productName] || 0) + item.quantity;
      });
    });

    return Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, quantity]) => ({ name, quantity }));
  };

  const getProductRevenueData = () => {
    const filtered = getFilteredTransactions();
    const productRevenue: Record<string, { name: string; value: number; quantity: number }> = {};

    filtered.forEach((transaction: Transaction) => {
      transaction.items.forEach((item: any) => {
        if (!productRevenue[item.productName]) {
          productRevenue[item.productName] = { name: item.productName, value: 0, quantity: 0 };
        }
        productRevenue[item.productName].value += (item.price * item.quantity);
        productRevenue[item.productName].quantity += item.quantity;
      });
    });

    return Object.values(productRevenue)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Calculate severity logic for the UI
  const alertItems = products.filter(p => (Number(p.quantity) + Number(p.newStockQuantity || 0)) <= p.reorderLevel);
  const combinedOutOfStock = alertItems.filter(p => (Number(p.quantity) + Number(p.newStockQuantity || 0)) === 0);
  const isCritical = combinedOutOfStock.length > 0;

  const mainAlertColor = isCritical ? '#ef4444' : '#f97316'; // Red vs Orange
  const mainAlertBg = isCritical ? '#fef2f2' : '#fff7ed';
  const mainAlertText = isCritical ? '#991b1b' : '#9a3412';

  return (
    <ErrorBoundary fallbackTitle="Dashboard Module Error">
      <div className="space-y-6">
        {/* Out of Stock Alert Pop-up */}
        <AlertDialog open={showOutOfStockAlert} onOpenChange={(open) => {
          if (!open) stopSpeaking();
          setShowOutOfStockAlert(open);
        }}>
          <AlertDialogContent className="max-w-md border-none shadow-2xl p-6" style={{ backgroundColor: '#fef2f2', borderRadius: '1.25rem' }}>
            <AlertDialogHeader>
              <AlertDialogTitle
                className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight"
                style={{ color: '#ef4444' }}
              >
                <AlertTriangle className="size-8" />
                OUT OF STOCK
              </AlertDialogTitle>
              <AlertDialogDescription
                className="text-base font-semibold"
                style={{ color: '#991b1b' }}
              >
                CRITICAL: Some products have reached 0 stock!
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="max-h-80 overflow-y-auto pr-2 space-y-3 my-5">
              {outOfStockProducts.map(product => (
                <div
                  key={product.id}
                  className="py-3 px-4 bg-white/60 backdrop-blur-sm rounded-xl border-none shadow-sm"
                >
                  <p className="font-bold text-gray-900">{product.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mt-1 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-red-600 animate-pulse" />
                    Status: EMPTY
                  </p>
                </div>
              ))}
            </div>

            <AlertDialogAction
              className="w-full font-bold uppercase tracking-widest py-7 shadow-lg hover:brightness-105 transition-all border-none"
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '1rem',
                fontSize: '1rem'
              }}
              onClick={() => {
                stopSpeaking();
                setShowOutOfStockAlert(false);
                localStorage.setItem('outOfStockDismissed', 'true');
                setTimeout(loadData, 100); // Check for Low Stock alert after dismissal
              }}
            >
              Acknowledge
            </AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>

        {/* Low Stock Alert Pop-up */}
        <AlertDialog open={showLowStockAlert} onOpenChange={(open) => {
          if (!open) stopSpeaking();
          setShowLowStockAlert(open);
        }}>
          <AlertDialogContent className="max-w-md border-none shadow-2xl p-6" style={{ backgroundColor: '#fff7ed', borderRadius: '1.25rem' }}>
            <AlertDialogHeader>
              <AlertDialogTitle
                className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight"
                style={{ color: '#f97316' }}
              >
                <AlertTriangle className="size-8" />
                LOW STOCK ALERT
              </AlertDialogTitle>
              <AlertDialogDescription
                className="text-base font-semibold"
                style={{ color: '#9a3412' }}
              >
                Attention: Some items are below reorder levels.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="max-h-80 overflow-y-auto pr-2 space-y-3 my-5">
              {lowStockProducts.map(product => (
                <div
                  key={product.id}
                  className="py-3 px-4 bg-white/60 backdrop-blur-sm rounded-xl border-none shadow-sm"
                >
                  <p className="font-bold text-gray-900">{product.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mt-1 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
                    Current Stock: {product.quantity} units
                  </p>
                </div>
              ))}
            </div>

            <AlertDialogAction
              className="w-full font-bold uppercase tracking-widest py-7 shadow-lg hover:brightness-105 transition-all border-none"
              style={{
                backgroundColor: '#f97316',
                color: 'white',
                borderRadius: '1rem',
                fontSize: '1rem'
              }}
              onClick={() => {
                stopSpeaking();
                setShowLowStockAlert(false);
                localStorage.setItem('lowStockDismissed', 'true');
                setTimeout(loadData, 100);
              }}
            >
              Acknowledge
            </AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
            <p className="text-sm text-gray-500 mt-1">Overview of your pharmacy operations</p>
          </div>


          <div className="flex items-center gap-3 w-full md:w-auto">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px] bg-white border-gray-200">
                <Calendar className="size-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Daily (Today)</SelectItem>
                <SelectItem value="7days">Weekly (Last 7 Days)</SelectItem>
                <SelectItem value="30days">Monthly (Last 30 Days)</SelectItem>
                <SelectItem value="yearly">Yearly (Last 365 Days)</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => speak(["Voice alerts are now active and ready"])}
              className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <TrendingUp className="size-4 mr-2" />
              Test Voice Alert
            </Button>
          </div>
        </div >

        {/* Stats Cards - Primary Row */}
        <ErrorBoundary fallbackTitle="Primary Stats Error">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-green-50 border-2 border-green-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-green-900">Total Sales</CardTitle>
                <TrendingUp className="size-6 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-green-700">{formatCurrency(stats.todaySales)}</div>
                <p className="text-xs font-semibold text-green-600 mt-1 uppercase tracking-wider">Total for {getFilterLabel()}</p>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 border-2 border-purple-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-purple-900">Estimated Profit</CardTitle>
                <PhilippinePeso className="size-6 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-purple-700">{formatCurrency(stats.todayProfit)}</div>
                <p className="text-xs font-semibold text-purple-600 mt-1 uppercase tracking-wider">Estimated for {getFilterLabel()}</p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-2 border-blue-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-blue-900">Transactions</CardTitle>
                <ReceiptText className="size-6 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-blue-700">{formatNumber(stats.todayTransactionsCount)}</div>
                <p className="text-xs font-semibold text-blue-600 mt-1 uppercase tracking-wider">Completed {timeRange === 'all' ? 'Historical' : `in ${getFilterLabel()}`}</p>
              </CardContent>
            </Card>

            <Card className="bg-cyan-50 border-2 border-cyan-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-cyan-900">Total Units</CardTitle>
                <Plus className="size-6 text-cyan-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-cyan-700">{formatNumber(stats.totalUnits)}</div>
                <p className="text-xs font-semibold text-cyan-600 mt-1 uppercase tracking-wider">Total inventory</p>
              </CardContent>
            </Card>
          </div>
        </ErrorBoundary>

        {/* Stats Cards - Secondary Row */}
        <ErrorBoundary fallbackTitle="Secondary Stats Error">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-slate-50 border-2 border-slate-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-slate-900">Total Products</CardTitle>
                <Package className="size-6 text-slate-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-700">{formatNumber(stats.totalProducts)}</div>
                <p className="text-xs font-semibold text-slate-600 mt-1 uppercase tracking-wider">Unique items</p>
              </CardContent>
            </Card>

            <Card
              className="bg-orange-50 border-2 border-orange-200 shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer hover:shadow-xl active:scale-95 hover:-translate-y-1"
              onClick={() => scrollToSection('low-stock-alerts')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-orange-900">Low Stock</CardTitle>
                <AlertTriangle className="size-6 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-orange-700">{formatNumber(stats.lowStock)}</div>
                <p className="text-xs font-semibold text-orange-600 mt-1 uppercase tracking-wider">Items need reorder</p>
              </CardContent>
            </Card>

            <Card
              className="bg-red-50 border-2 border-red-200 shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer hover:shadow-xl active:scale-95 hover:-translate-y-1"
              onClick={() => scrollToSection('out-of-stock-alerts')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-red-900">Out of Stock</CardTitle>
                <AlertTriangle className="size-6 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-red-700">{formatNumber(stats.outOfStock)}</div>
                <p className="text-xs font-semibold text-red-600 mt-1 uppercase tracking-wider">Critical status</p>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-2 border-amber-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-amber-900">Expiring Soon</CardTitle>
                <Calendar className="size-6 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-amber-700">{formatNumber(stats.expiringSoon)}</div>
                <p className="text-xs font-semibold text-amber-600 mt-1 uppercase tracking-wider">Next 30 days</p>
              </CardContent>
            </Card>
          </div>
        </ErrorBoundary>

        {/* Charts */}
        {/* Charts Grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300} key={timeRange}>
                <AreaChart data={getSalesData()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#84cc16" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(value) => `₱${formatNumber(value)}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Sales']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#65a30d" // Apple Green / Lime-600
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                    dot={(props: any) => {
                      const { cx, cy, stroke, payload, value } = props;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill="white"
                          stroke="#65a30d"
                          strokeWidth={2}
                        />
                      );
                    }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#65a30d' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sales by Category Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300} key={timeRange}>
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie
                    data={getSalesByCategory()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {getSalesByCategory().map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.name === 'Pharmaceutical' ? '#b7ec00' :
                          entry.name === 'Non-pharmaceutical' ? '#455900' :
                            COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <MovementAnalysis products={products} transactions={transactions} />

        {/* Product Sales Performance - Moved Below */}
        <div className="mt-8">
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="border-b border-gray-100 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900 uppercase">Product Sales Performance</CardTitle>
                  <p className="text-sm text-gray-500 font-medium">Revenue distribution and unit sales breakdown</p>
                </div>
                <TrendingUp className="size-8 text-blue-600 opacity-20" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 xl:grid-cols-2">
                {/* Product Revenue Section */}
                <div className="p-8 border-b xl:border-b-0 xl:border-r border-gray-100 flex flex-col items-center justify-center min-h-[400px]">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Revenue Growth</h3>
                  <ResponsiveContainer width="100%" height={300} key={timeRange}>
                    <BarChart data={getProductRevenueData()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={false}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                        tickFormatter={(value) => `₱${formatNumber(value)}`}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={48}
                        wrapperStyle={{ paddingTop: '20px' }}
                        payload={getProductRevenueData().map((item, index) => ({
                          value: item.name,
                          type: 'rect',
                          id: item.name,
                          color: COLORS[index % COLORS.length]
                        }))}
                      />
                      <Bar
                        dataKey="value"
                        name="Revenue"
                        radius={[6, 6, 0, 0]}
                      >
                        {getProductRevenueData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Table Section */}
                <div className="flex flex-col">
                  <div className="p-6 bg-gray-50/50 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Performance Details</h3>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-100">
                          <th className="p-4 border font-bold text-gray-700 uppercase tracking-wider text-xs">Product</th>
                          <th className="p-4 border font-bold text-gray-700 uppercase tracking-wider text-center text-xs">Units Sold</th>
                          <th className="p-4 border font-bold text-gray-700 uppercase tracking-wider text-right text-xs">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {getProductRevenueData().map((product, index) => (
                          <tr key={product.name} className="hover:bg-gray-50 transition-colors even:bg-gray-50/50">
                            <td className="p-4 border">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="size-2 rounded-full shrink-0"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="font-bold text-gray-900 truncate max-w-[150px] lg:max-w-[200px]" title={product.name}>{product.name}</span>
                              </div>
                            </td>
                            <td className="p-4 text-center border">
                              <Badge variant="outline" className="font-black text-blue-600 border-blue-100 bg-blue-50/30">
                                {product.quantity}
                              </Badge>
                            </td>
                            <td className="p-4 text-right font-black text-gray-900 border">
                              {formatCurrency(product.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Section */}
          {lowStockProducts.length > 0 && (
            <Card id="low-stock-alerts" className="border-2 border-orange-200 shadow-xl overflow-hidden scroll-mt-6">
              <CardHeader className="bg-orange-50 border-b border-orange-100 flex flex-row items-center justify-between py-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-6 text-orange-600" />
                  <CardTitle className="text-lg font-bold text-orange-900 uppercase">Low Stock</CardTitle>
                </div>
                <Badge className="bg-orange-500 hover:bg-orange-500 text-white font-bold px-3">
                  {lowStockProducts.length} REORDER
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[300px] overflow-y-auto divide-y divide-orange-100">
                  {lowStockProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-orange-50/20 transition-colors hover:bg-orange-100/30 gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="size-10 shrink-0 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                          <Package className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 truncate" title={product.name}>{product.name}</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">SKU: {product.sku}</p>
                        </div>
                      </div>
                      <Badge className="bg-orange-500 text-white font-black shrink-0">
                        STOCKS: {product.quantity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Out of Stock Section */}
          {outOfStockProducts.length > 0 && (
            <Card id="out-of-stock-alerts" className="border-2 border-red-200 shadow-xl overflow-hidden scroll-mt-6">
              <CardHeader className="bg-red-50 border-b border-red-100 flex flex-row items-center justify-between py-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-6 text-red-600" />
                  <CardTitle className="text-lg font-bold text-red-900 uppercase">Out of Stock</CardTitle>
                </div>
                <Badge variant="destructive" className="font-bold px-3">
                  {outOfStockProducts.length} CRITICAL
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[300px] overflow-y-auto divide-y divide-red-100">
                  {outOfStockProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-red-50/30 transition-colors hover:bg-red-100/50 gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="size-10 shrink-0 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                          <Package className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 truncate" title={product.name}>{product.name}</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">SKU: {product.sku}</p>
                        </div>
                      </div>
                      <Badge className="bg-red-600 text-white font-black italic shrink-0">
                        SOLD OUT
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div >
    </ErrorBoundary>
  );
}

function MovementAnalysis({ products, transactions }: { products: Product[], transactions: Transaction[] }) {
  const [timeRange, setTimeRange] = useState('monthly');

  const getFilteredTransactions = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Only completed transactions affect movement analytics.
    const completedTransactions = transactions.filter(
      (t: Transaction) => t.status === 'completed'
    );

    let cutoffDate = new Date(today);

    switch (timeRange) {
      case 'daily':
        break;
      case 'weekly':
        cutoffDate.setDate(today.getDate() - 7);
        break;
      case 'monthly':
        cutoffDate.setDate(1); // Start of this month
        break;
      case 'yearly':
        cutoffDate.setMonth(0, 1); // Start of this year (Jan 1st)
        break;
      default:
        return completedTransactions;
    }

    return completedTransactions.filter((t: Transaction) => {
      const txDate = new Date(t.date);
      const txDay = new Date(
        txDate.getFullYear(),
        txDate.getMonth(),
        txDate.getDate()
      );

      if (timeRange === 'daily') {
        return txDay.getTime() === today.getTime();
      }

      return txDay >= cutoffDate;
    });
  };

  const getMovementStats = () => {
    const filteredTx = getFilteredTransactions();
    const productSales: Record<string, number> = {};

    // Initialize all products with 0 sales
    products.forEach(p => {
      productSales[p.id] = 0;
    });

    // Sum up sales
    filteredTx.forEach(tx => {
      tx.items.forEach((item: any) => {
        if (productSales[item.productId] !== undefined) {
          productSales[item.productId] += item.quantity;
        }
      });
    });

    const entries = Object.entries(productSales).map(([id, quantity]) => {
      const product = products.find(p => p.id === id);
      return {
        id,
        name: product?.name || 'Unknown',
        sku: product?.sku || '-',
        currentStock: product?.quantity || 0,
        soldQuantity: quantity,
        product
      };
    });

    // Fast Moving: Sorted by sales desc, > 0
    const fastMoving = entries
      .filter(e => e.soldQuantity > 0)
      .sort((a, b) => b.soldQuantity - a.soldQuantity)
      .slice(0, 5);

    // Slow Moving: 0 sales, but has stock, sorted by stock desc (high stock but no sales is bad)
    const slowMoving = entries
      .filter(e => e.soldQuantity === 0 && e.currentStock > 0)
      .sort((a, b) => b.currentStock - a.currentStock)
      .slice(0, 5);

    return { fastMoving, slowMoving };
  };

  const stats = getMovementStats();
  const { fastMoving, slowMoving } = stats;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-full">
              <Package className="size-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-gray-900">Inventory Movement Analysis</CardTitle>
              <p className="text-xs text-gray-500">Fast vs Slow moving items based on sales history</p>
            </div>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Last 7 Days</SelectItem>
              <SelectItem value="monthly">This Month</SelectItem>
              <SelectItem value="yearly">This Year</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Fast Moving */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-green-700 uppercase tracking-wide">
                <TrendingUp className="size-4" />
                Fast Moving Items
              </h3>
              <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <Table>
                  <TableHeader className="bg-green-50">
                    <TableRow className="hover:bg-green-50">
                      <TableHead className="h-8 text-green-800 font-semibold">Product</TableHead>
                      <TableHead className="h-8 text-right text-green-800 font-semibold">Sold</TableHead>
                      <TableHead className="h-8 text-right text-green-800 font-semibold">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fastMoving.length > 0 ? (
                      fastMoving.map((item, i) => (
                        <TableRow key={item.id} className="hover:bg-gray-50">
                          <TableCell className="py-2 text-sm font-medium truncate max-w-[150px]" title={item.name}>{item.name}</TableCell>
                          <TableCell className="py-2 text-sm text-right font-bold text-green-600">{item.soldQuantity}</TableCell>
                          <TableCell className="py-2 text-sm text-right text-gray-500">{item.currentStock}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-gray-400 text-sm">No sales data for this period</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Slow Moving */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-red-700 uppercase tracking-wide">
                <TrendingDown className="size-4" />
                Slow Moving Items
              </h3>
              <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <Table>
                  <TableHeader className="bg-red-50">
                    <TableRow className="hover:bg-red-50">
                      <TableHead className="h-8 text-red-800 font-semibold">Product</TableHead>
                      <TableHead className="h-8 text-right text-red-800 font-semibold">Sold</TableHead>
                      <TableHead className="h-8 text-right text-red-800 font-semibold">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slowMoving.length > 0 ? (
                      slowMoving.map((item, i) => (
                        <TableRow key={item.id} className="hover:bg-gray-50">
                          <TableCell className="py-2 text-sm font-medium truncate max-w-[150px]" title={item.name}>{item.name}</TableCell>
                          <TableCell className="py-2 text-sm text-right font-bold text-gray-400">{item.soldQuantity}</TableCell>
                          <TableCell className="py-2 text-sm text-right text-red-600 font-medium">{item.currentStock}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-gray-400 text-sm">No slow moving items</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function getInitialProducts(): Product[] {
  return [
    {
      id: '1',
      name: 'Paracetamol 500mg',
      category: 'Pharmaceutical',
      sku: 'MED001',
      quantity: 150,
      price: 5.50,
      cost: 3.00,
      reorderLevel: 50,
      expiryDate: '2026-12-31',
      description: 'Pain reliever and fever reducer'
    },
    {
      id: '2',
      name: 'Amoxicillin 500mg',
      category: 'Pharmaceutical',
      sku: 'MED002',
      quantity: 80,
      price: 12.00,
      cost: 7.50,
      reorderLevel: 30,
      expiryDate: '2026-08-15',
      description: 'Antibiotic'
    },
    {
      id: '3',
      name: 'Vitamin C 1000mg',
      category: 'Non-pharmaceutical',
      sku: 'SUP001',
      quantity: 200,
      price: 8.00,
      cost: 5.00,
      reorderLevel: 50,
      expiryDate: '2027-03-20',
      description: 'Immune system support'
    },
    {
      id: '4',
      name: 'Hand Sanitizer 500ml',
      category: 'Non-pharmaceutical',
      sku: 'PC001',
      quantity: 45,
      price: 75.00,
      cost: 45.00,
      reorderLevel: 50,
      expiryDate: '2026-06-30',
      description: '70% alcohol-based sanitizer'
    },
    {
      id: '5',
      name: 'Face Mask (Box of 50)',
      category: 'Non-pharmaceutical',
      sku: 'PC002',
      quantity: 30,
      price: 150.00,
      cost: 90.00,
      reorderLevel: 20,
      expiryDate: '2026-05-15',
      description: 'Disposable surgical masks'
    },
    {
      id: '6',
      name: 'Thermometer Digital',
      category: 'Non-pharmaceutical',
      sku: 'EQ001',
      quantity: 25,
      price: 250.00,
      cost: 150.00,
      reorderLevel: 10,
      expiryDate: '2028-12-31',
      description: 'Digital thermometer'
    },
    {
      id: '7',
      name: 'Blood Pressure Monitor',
      category: 'Non-pharmaceutical',
      sku: 'EQ002',
      quantity: 15,
      price: 1500.00,
      cost: 950.00,
      reorderLevel: 5,
      expiryDate: '2029-01-01',
      description: 'Automatic BP monitor'
    },
    {
      id: '8',
      name: 'Bandage Roll',
      category: 'Non-pharmaceutical',
      sku: 'FA001',
      quantity: 100,
      price: 25.00,
      cost: 15.00,
      reorderLevel: 30,
      expiryDate: '2027-11-20',
      description: 'Elastic bandage roll'
    },
    {
      id: '9',
      name: 'Alcohol 70% 500ml',
      category: 'Non-pharmaceutical',
      sku: 'FA002',
      quantity: 60,
      price: 45.00,
      cost: 28.00,
      reorderLevel: 40,
      expiryDate: '2026-04-10',
      description: 'Isopropyl alcohol'
    },
    {
      id: '10',
      name: 'Multivitamins',
      category: 'Non-pharmaceutical',
      sku: 'SUP002',
      quantity: 120,
      price: 15.00,
      cost: 9.00,
      reorderLevel: 40,
      expiryDate: '2027-01-10',
      description: 'Daily multivitamin supplement'
    },
    {
      id: '11',
      name: 'Atorvastatin 20mg',
      category: 'Pharmaceutical',
      sku: 'MED003',
      quantity: 100,
      price: 25.00,
      cost: 15.00,
      reorderLevel: 20,
      expiryDate: '2027-04-15',
      description: 'Cholesterol-lowering medication'
    },
    {
      id: '12',
      name: 'Metformin 500mg',
      category: 'Pharmaceutical',
      sku: 'MED004',
      quantity: 120,
      price: 7.50,
      cost: 4.00,
      reorderLevel: 30,
      expiryDate: '2027-02-28',
      description: 'Diabetes medication'
    },
    {
      id: '13',
      name: 'Lisinopril 10mg',
      category: 'Pharmaceutical',
      sku: 'MED005',
      quantity: 90,
      price: 12.00,
      cost: 6.50,
      reorderLevel: 25,
      expiryDate: '2026-11-20',
      description: 'Hypertension medication'
    },
    {
      id: '14',
      name: 'Albuterol Inhaler',
      category: 'Pharmaceutical',
      sku: 'MED006',
      quantity: 20,
      price: 350.00,
      cost: 220.00,
      reorderLevel: 5,
      expiryDate: '2026-09-30',
      description: 'Bronchodilator for asthma'
    },
    {
      id: '15',
      name: 'Acetaminophen 500mg',
      category: 'Pharmaceutical',
      sku: 'MED007',
      quantity: 200,
      price: 4.50,
      cost: 2.00,
      reorderLevel: 50,
      expiryDate: '2026-12-15',
      description: 'Pain reliever and fever reducer'
    },
    {
      id: '16',
      name: 'Omeprazole 20mg',
      category: 'Pharmaceutical',
      sku: 'MED008',
      quantity: 80,
      price: 15.00,
      cost: 8.50,
      reorderLevel: 20,
      expiryDate: '2027-01-20',
      description: 'Stomach acid reducer'
    },
    {
      id: '17',
      name: 'Gabapentin 300mg',
      category: 'Pharmaceutical',
      sku: 'MED009',
      quantity: 60,
      price: 45.00,
      cost: 28.00,
      reorderLevel: 15,
      expiryDate: '2026-10-05',
      description: 'Nerve pain medication'
    },
    {
      id: '18',
      name: 'Levothyroxine 50mcg',
      category: 'Pharmaceutical',
      sku: 'MED010',
      quantity: 100,
      price: 18.00,
      cost: 10.00,
      reorderLevel: 30,
      expiryDate: '2027-03-31',
      description: 'Thyroid hormone replacement'
    },
    {
      id: '19',
      name: 'Amlodipine 5mg',
      category: 'Pharmaceutical',
      sku: 'MED011',
      quantity: 140,
      price: 6.50,
      cost: 3.50,
      reorderLevel: 40,
      expiryDate: '2027-05-12',
      description: 'Calcium channel blocker for BP'
    },
    {
      id: '20',
      name: 'Amoxicillin 250mg',
      category: 'Pharmaceutical',
      sku: 'MED012',
      quantity: 80,
      price: 9.00,
      cost: 5.00,
      reorderLevel: 25,
      expiryDate: '2026-08-15',
      description: 'Pediatric antibiotic variant'
    },
    {
      id: '21',
      name: 'Biogesic (Paracetamol)',
      category: 'Pharmaceutical',
      sku: 'MED013',
      quantity: 300,
      price: 5.00,
      cost: 2.50,
      reorderLevel: 100,
      expiryDate: '2026-12-31',
      description: 'Pain and fever relief'
    },
    {
      id: '22',
      name: 'Neozep Forte',
      category: 'Pharmaceutical',
      sku: 'MED014',
      quantity: 250,
      price: 6.50,
      cost: 3.50,
      reorderLevel: 80,
      expiryDate: '2026-11-20',
      description: 'Cold and flu relief'
    },
    {
      id: '23',
      name: 'Aspirin',
      category: 'Pharmaceutical',
      sku: 'MED015',
      quantity: 10,
      price: 15.00,
      cost: 8.00,
      reorderLevel: 5,
      expiryDate: '2025-06-01',
      description: 'Expired pain reliever'
    },
    {
      id: '24',
      name: 'Cough Syrup',
      category: 'Pharmaceutical',
      sku: 'MED016',
      quantity: 12,
      price: 45.00,
      cost: 25.00,
      reorderLevel: 10,
      expiryDate: '2025-10-15',
      description: 'Expired cough medication'
    },
    {
      id: '25',
      name: 'Antibiotics',
      category: 'Pharmaceutical',
      sku: 'MED017',
      quantity: 5,
      price: 120.00,
      cost: 70.00,
      reorderLevel: 5,
      expiryDate: '2025-12-20',
      description: 'Critically expired antibiotics'
    },
    {
      id: '26',
      name: 'Eye Drops',
      category: 'Pharmaceutical',
      sku: 'MED018',
      quantity: 8,
      price: 85.00,
      cost: 50.00,
      reorderLevel: 5,
      expiryDate: '2026-01-10',
      description: 'Expired eye medication'
    },
    {
      id: '27',
      name: 'Insulin',
      category: 'Pharmaceutical',
      sku: 'MED019',
      quantity: 15,
      price: 450.00,
      cost: 320.00,
      reorderLevel: 5,
      expiryDate: '2026-02-15',
      description: 'Expiring in February 2026'
    },
    {
      id: '28',
      name: 'Vitamins',
      category: 'Non-pharmaceutical',
      sku: 'SUP003',
      quantity: 30,
      price: 12.00,
      cost: 6.00,
      reorderLevel: 10,
      expiryDate: '2026-02-28',
      description: 'Expiring end of February 2026'
    },
    {
      id: '29',
      name: 'Lozenges',
      category: 'Pharmaceutical',
      sku: 'MED020',
      quantity: 40,
      price: 8.50,
      cost: 4.00,
      reorderLevel: 15,
      expiryDate: '2026-03-05',
      description: 'Expiring early March 2026'
    }
  ];
}
