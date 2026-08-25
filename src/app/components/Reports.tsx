import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { User, Product, Transaction, LossEntry } from '@/app/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Button } from '@/app/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, DollarSign, Package, ShoppingCart, Calendar, Download, AlertTriangle, Plus, Calculator, BarChart3 } from 'lucide-react';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { logAuditAction } from '@/app/utils/auditUtils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';

interface ReportsProps {
  currentUser: User;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-PH').format(value);
};

export function Reports({ currentUser }: ReportsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [losses, setLosses] = useState<LossEntry[]>([]);
  const [timeRange, setTimeRange] = useState('daily');
  const [isZReadingOpen, setIsZReadingOpen] = useState(false);
  const [isValuationOpen, setIsValuationOpen] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [productsRes, transactionsRes, lossesRes] = await Promise.all([
        fetch('/api/products.php'),
        fetch('/api/transactions.php'),
        fetch('/api/inventory_loss.php')
      ]);

      const productsData = await productsRes.json();
      const transactionsData = await transactionsRes.json();
      const lossesData = await lossesRes.json();

      if (Array.isArray(productsData)) setProducts(productsData);
      if (Array.isArray(transactionsData)) setTransactions(transactionsData);
      if (Array.isArray(lossesData)) setLosses(lossesData);

    } catch (error) {
      console.error("Error loading reports data:", error);
    }
  };

  const getFilteredTransactions = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let cutoffDate = new Date(today);

    switch (timeRange) {
      case 'daily':
        // Today
        break;
      case 'weekly':
        cutoffDate.setDate(today.getDate() - 7);
        break;
      case 'monthly':
        cutoffDate.setDate(1); // Start of this month
        break;
      case 'rolling_month':
        cutoffDate.setDate(today.getDate() - 30);
        break;
      case 'yearly':
        cutoffDate.setMonth(0, 1); // Start of this year (Jan 1st)
        break;
      default:
        return transactions.filter(t => t.status !== 'voided');
    }

    return transactions.filter(t => {
      if (t.status === 'voided') return false;
      const dateStr = t.date ? (t.date.includes('T') ? t.date : t.date.replace(' ', 'T')) : '';
      const txDate = new Date(dateStr);
      const txDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
      if (timeRange === 'daily') {
        return txDay.getTime() === today.getTime();
      }
      return txDay >= cutoffDate;
    });
  };

  const getFilteredLosses = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
      case 'rolling_month':
        cutoffDate.setDate(today.getDate() - 30);
        break;
      case 'yearly':
        cutoffDate.setMonth(0, 1); // Start of this year (Jan 1st)
        break;
      default:
        return losses;
    }

    return losses.filter(l => {
      const lossDate = new Date(l.date);
      const lossDay = new Date(lossDate.getFullYear(), lossDate.getMonth(), lossDate.getDate());
      if (timeRange === 'daily') {
        return lossDay.getTime() === today.getTime();
      }
      return lossDay >= cutoffDate;
    });
  };

  const calculateValuation = () => {
    let totalCostValue = 0;
    let totalRetailValue = 0;
    products.forEach(p => {
      const stock = Number(p.quantity) + Number(p.newStockQuantity || 0);
      if (stock > 0) {
        totalCostValue += stock * (Number(p.cost) || 0);
        totalRetailValue += stock * (Number(p.price) || 0);
      }
    });
    const potentialProfit = totalRetailValue - totalCostValue;
    return { totalCostValue, totalRetailValue, potentialProfit };
  };

  const calculateZReading = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let expectedCash = 0;
    let otherPayments = 0;
    let totalSales = 0;
    let totalTransactions = 0;

    transactions.forEach(t => {
      if (t.status === 'voided') return;
      const dateStr = t.date ? (t.date.includes('T') ? t.date : t.date.replace(' ', 'T')) : '';
      const txDate = new Date(dateStr);
      txDate.setHours(0, 0, 0, 0);
      
      if (txDate.getTime() === today.getTime()) {
        totalSales += t.total;
        totalTransactions++;
        if (!t.paymentMethod || t.paymentMethod.toLowerCase() === 'cash') {
          expectedCash += t.total;
        } else {
          otherPayments += t.total;
        }
      }
    });

    return { expectedCash, otherPayments, totalSales, totalTransactions };
  };


  const calculateStats = () => {
    const filtered = getFilteredTransactions();
    const filteredLosses = getFilteredLosses();
    const totalSales = filtered.reduce((sum, t) => sum + t.total, 0);
    const totalLoss = filteredLosses.reduce((sum, l) => sum + l.totalLoss, 0);
    const totalTransactions = filtered.length;
    const totalItems = filtered.reduce((sum, t) =>
      sum + t.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0
    );
    const totalProducts = products.length;
    const inventoryUnits = products.reduce((sum, p) => sum + p.quantity, 0);
    const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    return {
      totalSales,
      totalTransactions,
      totalItems,
      avgTransaction,
      totalLoss,
      totalProducts,
      inventoryUnits,
    };
  };

  const getSalesByCategory = () => {
    const filtered = getFilteredTransactions();
    const categorySales: Record<string, number> = {};

    filtered.forEach(transaction => {
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

  const getTopSellingProducts = () => {
    const filtered = getFilteredTransactions();
    const productSales: Record<string, { quantity: number; revenue: number; name: string }> = {};

    filtered.forEach(transaction => {
      transaction.items.forEach((item: any) => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            quantity: 0,
            revenue: 0,
            name: item.productName || 'Unknown Product'
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.quantity * item.price;
      });
    });

    return Object.entries(productSales)
      .map(([id, data]) => ({
        name: data.name,
        quantity: data.quantity,
        revenue: parseFloat(data.revenue.toFixed(2)),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  };

  const getDailySales = () => {
    // We use all transactions but filter by status and date range manually
    // to ensure the chart shows the full requested period accurately.
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let days = 7;
    let cutoff = new Date(today);

    switch (timeRange) {
      case 'daily': 
        days = 2; 
        cutoff.setDate(today.getDate() - 1);
        break;
      case 'weekly': 
        days = 7; 
        cutoff.setDate(today.getDate() - 6);
        break;
      case 'monthly': 
        days = today.getDate(); // Days so far this month
        cutoff.setDate(1);
        break;
      case 'rolling_month':
        days = 30;
        cutoff.setDate(today.getDate() - 29);
        break;
      case 'yearly':
        // Show months for yearly? For now sticking to days but maybe capping
        days = 365;
        cutoff.setMonth(0, 1);
        // If yearly is too many points, area chart handles it but maybe we should group by month
        break;
      default:
        days = 30;
        cutoff.setDate(today.getDate() - 29);
    }

    const txByDate = transactions
      .filter(t => t.status !== 'voided')
      .reduce((acc, t) => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        acc[key] = (acc[key] || 0) + t.total;
        return acc;
      }, {} as Record<string, number>);

    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(cutoff);
      d.setDate(d.getDate() + (days - 1 - i)); // iterate forward from cutoff
      // Wait, simpler logic:
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      
      const dateKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

      data.push({
        date: targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sales: parseFloat((txByDate[dateKey] || 0).toFixed(2)),
      });
    }

    return data;
  };

  const getPaymentMethodDistribution = () => {
    const filtered = getFilteredTransactions();
    const distribution: Record<string, number> = {};

    filtered.forEach(transaction => {
      const method = transaction.paymentMethod || 'cash';
      distribution[method] = (distribution[method] || 0) + 1;
    });

    return Object.entries(distribution).map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
    }));
  };

  const getProfitAnalysis = () => {
    const filtered = getFilteredTransactions();
    const filteredLosses = getFilteredLosses();
    let totalRevenue = 0;
    let totalCost = 0;

    filtered.forEach(transaction => {
      transaction.items.forEach((item: any) => {
        totalRevenue += item.quantity * item.price;
        // Use historical cost from the item if available, fallback to current product cost
        const itemCostPrice = item.cost !== undefined ? item.cost : (products.find(p => p.id === item.productId)?.cost || 0);
        totalCost += item.quantity * itemCostPrice;
      });
    });

    const inventoryLoss = filteredLosses.reduce((sum, l) => sum + l.totalLoss, 0);
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - inventoryLoss;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCost, grossProfit, inventoryLoss, netProfit, margin };
  };

  const stats = calculateStats();
  const profitAnalysis = getProfitAnalysis();

  const exportReport = () => {
    try {
      const doc = new jsPDF();
      let yPosition = 20;

      // ── Date range helpers ──────────────────────────────────────────────
      const fmt = (d: Date) =>
        d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const getDateRangeLabel = (): { display: string; filename: string } => {
        switch (timeRange) {
          case 'daily':
            return {
              display: fmt(todayDate),
              filename: `${todayDate.toISOString().split('T')[0]}`
            };
          case 'weekly': {
            const from = new Date(todayDate);
            from.setDate(todayDate.getDate() - 7);
            return {
              display: `${fmt(from)} to ${fmt(todayDate)}`,
              filename: `${from.toISOString().split('T')[0]}_to_${todayDate.toISOString().split('T')[0]}`
            };
          }
          case 'monthly': {
            const from = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
            return {
              display: `${fmt(from)} to ${fmt(todayDate)}`,
              filename: `${from.toISOString().split('T')[0]}_to_${todayDate.toISOString().split('T')[0]}`
            };
          }
          case 'yearly': {
            const from = new Date(todayDate.getFullYear(), 0, 1);
            return {
              display: `${fmt(from)} to ${fmt(todayDate)}`,
              filename: `${from.toISOString().split('T')[0]}_to_${todayDate.toISOString().split('T')[0]}`
            };
          }
          default: {
            const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const from = sorted.length > 0 ? new Date(sorted[0].date) : todayDate;
            return {
              display: `${fmt(from)} to ${fmt(todayDate)}`,
              filename: `${from.toISOString().split('T')[0]}_to_${todayDate.toISOString().split('T')[0]}`
            };
          }
        }
      };

      const dateRange = getDateRangeLabel();
      const periodLabel = timeRange === 'daily' ? 'DAILY' :
        timeRange === 'weekly' ? 'WEEKLY' :
          timeRange === 'monthly' ? 'MONTHLY' :
            timeRange === 'yearly' ? 'YEARLY' : 'ALL TIME';

      // ── PDF helpers ─────────────────────────────────────────────────────
      const formatCurrencyForPDF = (value: number) => {
        return formatCurrency(value).replace('₱', 'P');
      };

      const drawHeader = (title: string, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(title, 14, y);
        return y + 8;
      };

      const drawTableRow = (labels: string[], values: string[], y: number) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setDrawColor(0, 0, 0);
        let currentY = y;

        const tableHeight = (labels.length * 8) + 2;
        doc.rect(14, currentY - 5, 182, tableHeight);
        doc.line(115, currentY - 5, 115, currentY - 5 + tableHeight);

        labels.forEach((label, i) => {
          doc.text(label, 17, currentY);
          doc.text(values[i], 118, currentY);
          if (i < labels.length - 1) {
            doc.line(14, currentY + 3, 196, currentY + 3);
          }
          currentY += 8;
        });
        return currentY + 8;
      };

      // ── Header Branding ─────────────────────────────────────────────────
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('Zoe Pharmacy & General Merchandise', 14, yPosition);
      yPosition += 8;

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('SALES SUMMARY REPORT', 14, yPosition);
      yPosition += 12;

      // Report Info Table
      yPosition = drawHeader('REPORT SPECIFICATIONS', yPosition);
      yPosition = drawTableRow(
        ['Generated Date/Time', 'Report Type', 'Coverage Period', 'Business Name'],
        [now.toLocaleString(), periodLabel, dateRange.display, 'Zoe Pharmacy & GM'],
        yPosition
      );

      // Key Metrics Table
      yPosition = drawHeader('KEY PERFORMANCE INDICATORS', yPosition);
      yPosition = drawTableRow(
        ['Total Sales Amount', 'Total Transactions', 'Total Items Sold', 'Average Transaction Value', 'Total Loss'],
        [
          formatCurrencyForPDF(stats.totalSales),
          formatNumber(stats.totalTransactions),
          formatNumber(stats.totalItems),
          formatCurrencyForPDF(stats.avgTransaction),
          formatCurrencyForPDF(profitAnalysis.inventoryLoss)
        ],
        yPosition
      );

      // Profit Analysis Table
      yPosition = drawHeader('PROFITABILITY OVERVIEW', yPosition);
      yPosition = drawTableRow(
        ['Gross Revenue', 'Total Cost of Goods', 'Gross Profit', 'Inventory Loss', 'Net Profit', 'Profit Margin (%)'],
        [
          formatCurrencyForPDF(profitAnalysis.totalRevenue),
          formatCurrencyForPDF(profitAnalysis.totalCost),
          formatCurrencyForPDF(profitAnalysis.grossProfit),
          formatCurrencyForPDF(profitAnalysis.inventoryLoss),
          formatCurrencyForPDF(profitAnalysis.netProfit),
          `${profitAnalysis.margin.toFixed(2)}%`
        ],
        yPosition
      );

      // Sales by Category Table
      const categoryData = getSalesByCategory();
      if (categoryData.length > 0) {
        yPosition = drawHeader('SALES BY PRODUCT CATEGORY', yPosition);
        yPosition = drawTableRow(
          categoryData.map(c => c.name),
          categoryData.map(c => formatCurrencyForPDF(c.value)),
          yPosition
        );
      }

      // Payment Method Table
      const paymentData = getPaymentMethodDistribution();
      if (paymentData.length > 0) {
        yPosition = drawHeader('PAYMENT METHOD DISTRIBUTION', yPosition);
        yPosition = drawTableRow(
          paymentData.map(p => p.name),
          paymentData.map(p => `${p.value} Transactions`),
          yPosition
        );
      }

      // Top Products Table
      const topProducts = getTopSellingProducts();
      if (topProducts.length > 0) {
        if (yPosition > 220) {
          doc.addPage();
          yPosition = 30;
        }
        yPosition = drawHeader('TOP SELLING PRODUCTS (RANKED BY REVENUE)', yPosition);

        const drawProductHeader = (y: number) => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(0, 0, 0);
          doc.setFillColor(245, 245, 245);
          doc.rect(14, y - 5, 182, 7, 'F');
          doc.setDrawColor(0, 0, 0);
          doc.rect(14, y - 5, 182, 7, 'S');
          doc.text('Product Name', 17, y);
          doc.text('Quantity Sold', 100, y);
          doc.text('Total Revenue', 145, y);
          return y + 8;
        };

        yPosition = drawProductHeader(yPosition);
        doc.setFont('helvetica', 'normal');

        topProducts.slice(0, 15).forEach((product) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 30;
            yPosition = drawProductHeader(yPosition);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.setDrawColor(0, 0, 0);
          }

          doc.setDrawColor(0, 0, 0);
          doc.rect(14, yPosition - 5, 182, 8);
          doc.line(95, yPosition - 5, 95, yPosition + 3);
          doc.line(140, yPosition - 5, 140, yPosition + 3);

          doc.setTextColor(0, 0, 0);
          doc.text(product.name, 17, yPosition);
          doc.text(formatNumber(product.quantity), 100, yPosition);
          doc.text(formatCurrencyForPDF(product.revenue), 145, yPosition);
          yPosition += 8;
        });
      }

      doc.save(`Zoe_Sales_Report_${periodLabel}_${dateRange.filename}.pdf`);
      logAuditAction(
          currentUser.name,
          'Report Download',
          `Downloaded ${periodLabel} sales report (${dateRange.display})`
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF');
    }
  };

  return (
    <ErrorBoundary fallbackTitle="Reports Module Error">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Reports & Analytics</h2>
            <p className="text-sm text-gray-500 mt-1">Detailed insights into your business</p>
          </div>
          <div className="flex gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
                <SelectItem value="rolling_month">Last 30 Days</SelectItem>
                <SelectItem value="yearly">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setIsZReadingOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Calculator className="size-4 mr-2" />
              Z-Reading
            </Button>
            <Button
              onClick={() => setIsValuationOpen(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
            >
              <BarChart3 className="size-4 mr-2" />
              Valuation
            </Button>
            <Button
              onClick={exportReport}
              className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
            >
              <span className="mr-2">📄</span>
              Download
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <ErrorBoundary fallbackTitle="Key Metrics Error">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <Card className="bg-purple-50 border-2 border-purple-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-purple-900">Total Sales</CardTitle>
                <DollarSign className="size-6 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-purple-700">{formatCurrency(stats.totalSales)}</div>
                <p className="text-[10px] font-semibold text-purple-600 mt-1 uppercase tracking-wider">Revenue generated</p>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-2 border-red-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-red-900">Total Loss</CardTitle>
                <AlertTriangle className="size-6 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-red-700">{formatCurrency(stats.totalLoss)}</div>
                <p className="text-[10px] font-semibold text-red-600 mt-1 uppercase tracking-wider">Expired/Damaged</p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-2 border-blue-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-blue-900">Transactions</CardTitle>
                <ShoppingCart className="size-6 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-blue-700">{formatNumber(stats.totalTransactions)}</div>
                <p className="text-[10px] font-semibold text-blue-600 mt-1 uppercase tracking-wider">Completed sales</p>
              </CardContent>
            </Card>

            <Card className="bg-indigo-50 border-2 border-indigo-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-indigo-900">Items Sold</CardTitle>
                <Package className="size-6 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-indigo-700">{formatNumber(stats.totalItems)}</div>
                <p className="text-[10px] font-semibold text-indigo-600 mt-1 uppercase tracking-wider">Total units</p>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 border-2 border-orange-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-orange-900">Avg Transaction</CardTitle>
                <TrendingUp className="size-6 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-orange-700">{formatCurrency(stats.avgTransaction)}</div>
                <p className="text-[10px] font-semibold text-orange-600 mt-1 uppercase tracking-wider">Per sale</p>
              </CardContent>
            </Card>
          </div>
        </ErrorBoundary>

        {/* Profit Analysis */}
        <ErrorBoundary fallbackTitle="Profit Analysis Error">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Profit Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Gross Revenue</p>
                    <p className="text-2xl font-semibold text-purple-600">{formatCurrency(profitAnalysis.totalRevenue)}</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Product Cost</p>
                    <p className="text-2xl font-semibold text-blue-600">{formatCurrency(profitAnalysis.totalCost)}</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Gross Profit</p>
                    <p className="text-2xl font-semibold text-orange-600">{formatCurrency(profitAnalysis.grossProfit)}</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Inventory Loss</p>
                    <p className="text-2xl font-semibold text-red-600">{formatCurrency(profitAnalysis.inventoryLoss)}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Net Profit</p>
                    <p className="text-2xl font-semibold text-green-600">{formatCurrency(profitAnalysis.netProfit)}</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-dashed border-yellow-300 text-center">
                  <p className="text-sm text-gray-500">
                    <span className="font-bold">Net Margin:</span> <span className="text-[#DAA520] font-black">{profitAnalysis.margin.toFixed(1)}%</span>
                    <span className="mx-2">|</span>
                    <span className="italic text-xs text-red-500">Includes deductions from expired and disposed inventory.</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </ErrorBoundary>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ErrorBoundary fallbackTitle="Sales Trend Chart Error">
            <Card>
              <CardHeader>
                <CardTitle>Daily Sales Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300} key={timeRange}>
                  <AreaChart data={getDailySales()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDailySales" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#colorDailySales)"
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
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Sales by Category Error">
            <Card>
              <CardHeader>
                <CardTitle>Sales by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300} key={timeRange}>
                  <PieChart margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
                    <Pie
                      data={getSalesByCategory()}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
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
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Payment Method Chart Error">
            <Card>
              <CardHeader>
                <CardTitle>Payment Method Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300} key={timeRange}>
                  <BarChart data={getPaymentMethodDistribution()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={false} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [formatNumber(value), 'Transactions']} />
                    <Legend payload={[
                      { value: 'CASH', type: 'rect', id: 'cash', color: '#b7ec00' }
                    ]} />
                    <Bar dataKey="value">
                      {getPaymentMethodDistribution().map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill="#b7ec00"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Top Products Chart Error">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Products by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350} key={timeRange}>
                  <BarChart data={getTopSellingProducts().slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(value) => `₱${formatNumber(value)}`} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={140} 
                      tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                      tickFormatter={(name) => name.length > 22 ? name.substring(0, 22) + '...' : name}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']} 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#8bb300" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </ErrorBoundary>
        </div>

        {/* Top Selling Products Table */}
        <ErrorBoundary fallbackTitle="Products Table Error">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="border px-4 py-2 bg-gray-100 font-bold text-gray-700">Rank</TableHead>
                    <TableHead className="border px-4 py-2 bg-gray-100 font-bold text-gray-700">Product Name</TableHead>
                    <TableHead className="border px-4 py-2 bg-gray-100 font-bold text-gray-700 text-center">Quantity Sold</TableHead>
                    <TableHead className="border px-4 py-2 bg-gray-100 font-bold text-gray-700 text-center">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getTopSellingProducts().map((product, index) => (
                    <TableRow key={index} className="hover:bg-gray-50 transition-colors even:bg-gray-50/50">
                      <TableCell className="font-medium border px-4 py-2 text-center w-16">#{index + 1}</TableCell>
                      <TableCell className="border px-4 py-2 font-medium">
                        <div className="truncate max-w-[150px] md:max-w-[250px] lg:max-w-[350px]" title={product.name}>
                          {product.name}
                        </div>
                      </TableCell>
                      <TableCell className="border px-4 py-2 text-center text-gray-500">{formatNumber(product.quantity)}</TableCell>
                      <TableCell className="font-bold text-gray-900 border px-4 py-2 text-center">{formatCurrency(product.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {getTopSellingProducts().length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                        No sales data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          </Card>
        </ErrorBoundary>
      </div>

      {/* Z-Reading Dialog */}
      <Dialog open={isZReadingOpen} onOpenChange={setIsZReadingOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="size-5 text-indigo-600" />
              End-of-Day Z-Reading
            </DialogTitle>
            <DialogDescription>
              Summary of today's expected cash drawer and logged transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md border">
              <span className="text-sm font-medium text-gray-500">Total Transactions Today:</span>
              <span className="text-lg font-bold">{calculateZReading().totalTransactions}</span>
            </div>
            <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-md border-2 border-indigo-200">
              <span className="font-bold text-indigo-900">Total Expected Drawer Cash:</span>
              <span className="text-2xl font-black text-indigo-700">{formatCurrency(calculateZReading().expectedCash)}</span>
            </div>
            <div className="flex justify-between items-center bg-green-50 p-3 rounded-md border-t-2 border-green-200 mt-2">
              <span className="font-bold text-green-900">Total Sales Generated Today:</span>
              <span className="text-xl font-bold text-green-700">{formatCurrency(calculateZReading().totalSales)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsZReadingOpen(false)} className="w-full">Acknowledge Shift Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Valuation Report Dialog */}
      <Dialog open={isValuationOpen} onOpenChange={setIsValuationOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-teal-600" />
              Inventory Valuation Report
            </DialogTitle>
            <DialogDescription>
              Calculation of total cost value and potential retail value of current stock.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-md border-2 border-blue-200">
              <span className="font-bold text-blue-900">Total Cost Value (Puhunan):</span>
              <span className="text-xl font-black text-blue-700">{formatCurrency(calculateValuation().totalCostValue)}</span>
            </div>
            <div className="flex justify-between items-center bg-teal-50 p-4 rounded-md border-2 border-teal-200">
              <span className="font-bold text-teal-900">Total Retail Value (Benta):</span>
              <span className="text-xl font-black text-teal-700">{formatCurrency(calculateValuation().totalRetailValue)}</span>
            </div>
            <div className="flex justify-between items-center bg-green-50 p-3 rounded-md border-t-2 border-green-200 mt-2">
              <span className="font-bold text-green-900">Total Potential Profit:</span>
              <span className="text-lg font-bold text-green-700">{formatCurrency(calculateValuation().potentialProfit)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsValuationOpen(false)} className="w-full">Close Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}
