import { useState, useEffect } from 'react';
import { User, Transaction } from '@/app/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent } from '@/app/components/ui/dialog';
import { Search, ReceiptText, Eye, Download, ChevronLeft, ChevronRight, Calendar, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { OwnerPasscodeModal } from '@/app/components/OwnerPasscodeModal';

interface TransactionHistoryProps {
  currentUser: User;
}

const SwipeToVoid = ({
  onVoid,
  label = "SWIPE TO CONFIRM VOID >>>",
  disabled = false,
  isProcessing = false
}: {
  onVoid: () => void;
  label?: string;
  disabled?: boolean;
  isProcessing?: boolean;
}) => {
  const [val, setVal] = useState(0);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    if (!isProcessing) {
      setHasTriggered(false);
      setVal(0);
    }
  }, [isProcessing, disabled]);

  if (isProcessing) {
    return (
      <div className="relative w-full h-12 bg-red-50 rounded-lg overflow-hidden flex items-center justify-center shadow-inner mt-4 border border-red-300 text-red-800 text-xs font-black uppercase tracking-wider animate-pulse">
        Processing Void... Please wait
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="relative w-full h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center shadow-inner mt-4 border border-gray-200 text-gray-400 text-xs font-bold uppercase tracking-wider">
        Select at least 1 item to void
      </div>
    );
  }

  return (
    <div className="relative w-full h-12 bg-red-100 rounded-lg overflow-hidden flex items-center shadow-inner mt-4 border border-red-200 select-none">
      <div className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-black tracking-wider text-red-800 pointer-events-none opacity-90 px-3 text-center truncate">
        {label}
      </div>
      <div
        className="absolute top-0 left-0 bottom-0 bg-red-500 opacity-20 pointer-events-none"
        style={{ width: `${val}%` }}
      />
      <input
        type="range"
        min="0"
        max="100"
        value={val}
        disabled={disabled || hasTriggered || isProcessing}
        onChange={(e) => {
          if (hasTriggered || isProcessing) return;
          const v = Number(e.target.value);
          setVal(v);
          if (v > 92 && !hasTriggered) {
            setHasTriggered(true);
            setVal(100);
            onVoid();
          }
        }}
        onMouseUp={() => { if (val <= 92 && !hasTriggered) setVal(0); }}
        onTouchEnd={() => { if (val <= 92 && !hasTriggered) setVal(0); }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
      />
      <div
        className="absolute top-1 bottom-1 w-10 bg-red-600 rounded flex items-center justify-center shadow-md pointer-events-none text-white font-bold transition-all duration-75"
        style={{ left: `calc(${val * 0.85}% + 4px)` }}
      >
        &gt;
      </div>
    </div>
  );
};

export function TransactionHistory({ currentUser }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionToVoid, setTransactionToVoid] = useState<Transaction | null>(null);
  const [transactionWaitingPasscode, setTransactionWaitingPasscode] = useState<Transaction | null>(null);
  const [selectedItemIndicesToVoid, setSelectedItemIndicesToVoid] = useState<Set<number>>(new Set());
  const [voidQuantities, setVoidQuantities] = useState<Record<number, number>>({});
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Start with ALL UNCHECKED by default and initialize max quantities
  useEffect(() => {
    setSelectedItemIndicesToVoid(new Set());
    if (transactionToVoid) {
      const activeItems = (transactionToVoid.items || []).filter((it: any) => it.status !== 'voided');
      const initialQtys: Record<number, number> = {};
      activeItems.forEach((it: any, idx: number) => {
        initialQtys[idx] = it.quantity;
      });
      setVoidQuantities(initialQtys);
    } else {
      setVoidQuantities({});
    }
  }, [transactionToVoid]);

  useEffect(() => {
    loadTransactions();
    const interval = setInterval(loadTransactions, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadTransactions = async () => {
    try {
      const response = await fetch('/api/transactions.php');
      let data = await response.json();
      if (Array.isArray(data)) {
        data.sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(data);
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
    }
  };

  const handleVoidTransaction = async (
    id: string,
    itemsToVoidList?: Array<{ itemId?: number; productId: string; quantity: number; price: number; productName: string }>,
    isFullVoidFlag?: boolean
  ) => {
    if (isVoiding) return;
    setIsVoiding(true);
    try {
      const activeItems = (transactionToVoid?.items || []).filter(it => it.status !== 'voided');
      const isFull = isFullVoidFlag ?? (!itemsToVoidList || (activeItems.length > 0 && itemsToVoidList.length === activeItems.length));

      const response = await fetch('/api/transactions.php', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Name': currentUser.name,
        },
        body: JSON.stringify({
          id,
          action: 'void',
          isFullVoid: isFull,
          itemsToVoid: itemsToVoidList
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.message || 'Failed to void transaction');
      }

      if (data.type === 'partial') {
        toast.success(`Partial void completed. ₱${Number(data.refundAmount || 0).toFixed(2)} refunded.`);
      } else {
        toast.success(`Transaction #${id} voided successfully`);
      }

      setTransactionToVoid(null);

      setSelectedTransactionIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      await loadTransactions();
      window.dispatchEvent(new CustomEvent('inventory-updated'));

      if (selectedTransaction && selectedTransaction.id === id) {
        if (data.type === 'partial') {
          const res = await fetch('/api/transactions.php');
          const list = await res.json();
          if (Array.isArray(list)) {
            const updated = list.find((t: Transaction) => t.id === id);
            if (updated) setSelectedTransaction(updated);
          }
        } else {
          setSelectedTransaction(prev => prev ? { ...prev, status: 'voided' } : null);
        }
      }
    } catch (error: any) {
      console.error("Void Error:", error);
      toast.error(error.message || "Failed to void transaction");
    } finally {
      setIsVoiding(false);
    }
  };
  const parseDate = (ds: string) => {
    if (!ds) return new Date();
    const clean = ds.includes('T') ? ds : ds.replace(' ', 'T');
    return new Date(clean);
  };

  const isToday = (dateString: string) => {
    const d = parseDate(dateString);
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  const isThisWeek = (dateString: string) => {
    const d = parseDate(dateString);
    const today = new Date();
    
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    lastWeek.setHours(0, 0, 0, 0);

    return d >= lastWeek && d <= today;
  };

  const isThisMonth = (dateString: string) => {
    const d = parseDate(dateString);
    const today = new Date();
    return d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  const formatDate = (ds: string) => {
    if (!ds) return '';
    const date = parseDate(ds);
    if (isNaN(date.getTime())) return ds;
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const filteredTransactions = transactions.filter(t => {
    const s = searchQuery.toLowerCase();
    const idMatch = String(t.id).includes(s);
    const cashierMatch = (t.cashier || '').toLowerCase().includes(s);
    const itemsMatch = t.items && t.items.some(i => (i.productName || '').toLowerCase().includes(s));

    let dateMatch = true;
    if (dateFilter === 'today') dateMatch = isToday(t.date);
    else if (dateFilter === 'week') dateMatch = isThisWeek(t.date);
    else if (dateFilter === 'month') dateMatch = isThisMonth(t.date);

    return (idMatch || cashierMatch || itemsMatch) && dateMatch;
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginated = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startShowing = ((currentPage - 1) * itemsPerPage) + 1;
  const endShowing = Math.min(currentPage * itemsPerPage, filteredTransactions.length);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTransactionIds(new Set(filteredTransactions.map(t => t.id)));
    } else {
      setSelectedTransactionIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedTransactionIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedTransactionIds(newSet);
  };

  const getConsolidatedOriginalItems = (items: any[]) => {
    const map = new Map<string, { productId: string; productName: string; price: number; quantity: number }>();
    const list: Array<{ productId: string; productName: string; price: number; quantity: number }> = [];

    (items || []).forEach((it: any) => {
      const key = it.productId ? String(it.productId) : `${(it.productName || '').trim().toLowerCase()}_${Number(it.price || 0).toFixed(2)}`;
      const price = Number(it.price || 0);
      const qty = Number(it.quantity || 0);

      if (map.has(key)) {
        map.get(key)!.quantity += qty;
      } else {
        const entry = {
          productId: it.productId,
          productName: it.productName || 'Unknown',
          price,
          quantity: qty
        };
        map.set(key, entry);
        list.push(entry);
      }
    });

    return list;
  };

  const generatePDF = (t: Transaction) => {
    const consolidatedItems = getConsolidatedOriginalItems(t.items || []);
    if (consolidatedItems.length === 0) {
      toast.error('No items found in this transaction.');
      return;
    }

    // Retain original copy of transaction before void
    const originalTotal = consolidatedItems.reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
    const amountReceived = t.amountReceived != null ? Number(t.amountReceived) : originalTotal;
    const originalChange = Math.max(0, amountReceived - originalTotal);

    // Calculate required height: Base height (approx 150mm) + 12mm per consolidated item
    const itemsCount = consolidatedItems.length;
    const estimatedHeight = 150 + (itemsCount * 12);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [80, estimatedHeight] });

    doc.setFont("courier", "bold");
    doc.setFontSize(10);

    let y = 10;

    doc.text('ZOE PHARMACY & GENERAL', 40, y, { align: 'center' }); y += 4;
    doc.text('MERCHANDISE', 40, y, { align: 'center' }); y += 4;
    doc.setFontSize(8);
    doc.text('40 MATA COR, MANLUNAS STS.,', 40, y, { align: 'center' }); y += 3.5;
    doc.text('VAB BRGY, 183, PASAY CITY,', 40, y, { align: 'center' }); y += 3.5;
    doc.text('METRO MANILA', 40, y, { align: 'center' }); y += 6;
    doc.setFontSize(10);

    doc.setFont("courier", "normal");
    doc.text('----------------------------------', 40, y, { align: 'center' }); y += 6;

    doc.text(`TRANS ID: ${t.id}`, 4, y); y += 4;
    doc.text(`DATE: ${formatDate(t.date)}`, 4, y); y += 4;
    doc.text(`CASHIER: ${(t.cashier || 'ZOE OWNER').toUpperCase()}`, 4, y); y += 8;

    doc.text('----------------------------------', 40, y, { align: 'center' }); y += 6;

    doc.text('ITEM DESCRIPTION', 4, y);
    doc.text('PRICE', 76, y, { align: 'right' }); y += 6;

    consolidatedItems.forEach(it => {
      const productName = (it.productName || 'Unknown').substring(0, 20).toUpperCase();
      doc.text(productName, 4, y);
      doc.text(`P${(it.price * it.quantity).toFixed(2)}`, 76, y, { align: 'right' }); y += 4;
      doc.text(`${it.quantity} units x P${it.price.toFixed(2)}`, 4, y); y += 6;
    });

    doc.text('__________________________________', 40, y, { align: 'center' }); y += 8;

    doc.setFont("courier", "bold");
    doc.text(`TOTAL AMOUNT`, 4, y);
    doc.text(`P${originalTotal.toFixed(2)}`, 76, y, { align: 'right' }); y += 8;

    doc.setFont("courier", "normal");
    doc.text(`CASH RECEIVED`, 4, y);
    doc.text(`P${amountReceived.toFixed(2)}`, 76, y, { align: 'right' }); y += 6;
    doc.setFont("courier", "bold");
    doc.text(`CHANGE DUE`, 4, y);
    doc.text(`P${originalChange.toFixed(2)}`, 76, y, { align: 'right' }); y += 10;

    doc.text(`THANK YOU FOR YOUR TRUST!`, 40, y, { align: 'center' }); y += 6;
    doc.setFontSize(8);
    doc.setFont("courier", "normal");
    doc.text(`--- NO REFUND WITHOUT TRANSACTION DETAILS ---`, 40, y, { align: 'center' }); y += 4;
    doc.setFont("courier", "italic");
    doc.text(`This is not an official transaction record.`, 40, y, { align: 'center' });

    doc.save(`receipt_${t.id}.pdf`);
  };

  const exportAllPDF = () => {
    const rawToExport = selectedTransactionIds.size > 0
      ? filteredTransactions.filter(t => selectedTransactionIds.has(t.id))
      : filteredTransactions;

    const transactionsToExport = rawToExport.filter(t => (t.items || []).length > 0);

    if (transactionsToExport.length === 0) {
      toast.error('No transactions available to download.');
      return;
    }

    const firstConsolidated = getConsolidatedOriginalItems(transactionsToExport[0].items || []);
    const firstHeight = 150 + (firstConsolidated.length * 12);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [80, firstHeight] });

    transactionsToExport.forEach((t, index) => {
      const consolidatedItems = getConsolidatedOriginalItems(t.items || []);
      const originalTotal = consolidatedItems.reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
      const amountReceived = t.amountReceived != null ? Number(t.amountReceived) : originalTotal;
      const originalChange = Math.max(0, amountReceived - originalTotal);

      if (index > 0) {
        const estimatedHeight = 150 + (consolidatedItems.length * 12);
        doc.addPage([80, estimatedHeight]);
      }

      doc.setFont("courier", "bold");
      doc.setFontSize(10);

      let y = 10;

      doc.text('ZOE PHARMACY & GENERAL', 40, y, { align: 'center' }); y += 4;
      doc.text('MERCHANDISE', 40, y, { align: 'center' }); y += 4;
      doc.setFontSize(8);
      doc.text('40 MATA COR, MANLUNAS STS.,', 40, y, { align: 'center' }); y += 3.5;
      doc.text('VAB BRGY, 183, PASAY CITY,', 40, y, { align: 'center' }); y += 3.5;
      doc.text('METRO MANILA', 40, y, { align: 'center' }); y += 6;
      doc.setFontSize(10);

      doc.setFont("courier", "normal");
      doc.text('----------------------------------', 40, y, { align: 'center' }); y += 6;

      doc.text(`TRANS ID: ${t.id}`, 4, y); y += 4;
      doc.text(`DATE: ${formatDate(t.date)}`, 4, y); y += 4;
      doc.text(`CASHIER: ${(t.cashier || 'ZOE OWNER').toUpperCase()}`, 4, y); y += 8;

      doc.text('----------------------------------', 40, y, { align: 'center' }); y += 6;

      doc.text('ITEM DESCRIPTION', 4, y);
      doc.text('PRICE', 76, y, { align: 'right' }); y += 6;

      consolidatedItems.forEach((it: any) => {
        const productName = (it.productName || 'Unknown').substring(0, 20).toUpperCase();
        doc.text(productName, 4, y);
        doc.text(`P${(it.price * it.quantity).toFixed(2)}`, 76, y, { align: 'right' }); y += 4;
        doc.text(`${it.quantity} units x P${it.price.toFixed(2)}`, 4, y); y += 6;
      });

      doc.text('__________________________________', 40, y, { align: 'center' }); y += 8;

      doc.setFont("courier", "bold");
      doc.text(`TOTAL AMOUNT`, 4, y);
      doc.text(`P${originalTotal.toFixed(2)}`, 76, y, { align: 'right' }); y += 8;

      doc.setFont("courier", "normal");
      doc.text(`CASH RECEIVED`, 4, y);
      doc.text(`P${amountReceived.toFixed(2)}`, 76, y, { align: 'right' }); y += 6;
      doc.setFont("courier", "bold");
      doc.text(`CHANGE DUE`, 4, y);
      doc.text(`P${originalChange.toFixed(2)}`, 76, y, { align: 'right' }); y += 10;

      doc.text(`THANK YOU FOR YOUR TRUST!`, 40, y, { align: 'center' }); y += 6;
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      doc.text(`--- NO REFUND WITHOUT TRANSACTION DETAILS ---`, 40, y, { align: 'center' }); y += 4;
      doc.setFont("courier", "italic");
      doc.text(`This is not an official transaction record.`, 40, y, { align: 'center' });
    });

    doc.save('all_receipts_export.pdf');
  };

  return (
    <ErrorBoundary fallbackTitle="Transaction History Module Error">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#1f2937]">Transaction History</h2>
            <p className="text-sm text-gray-400 mt-1">View all sales transactions</p>
          </div>
          <Button
            onClick={exportAllPDF}
            className="bg-[#1f2937] hover:bg-gray-800 text-white font-medium shadow-sm transition-all rounded-md px-5 h-10 flex items-center gap-2"
          >
            <Download className="size-4" />
            {selectedTransactionIds.size > 0 ? `Download Selected (${selectedTransactionIds.size})` : 'Download All'}
          </Button>
        </div>

        <div className="border border-gray-100 rounded-xl bg-white p-3 shadow-sm flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search by transaction ID, cashier, or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 border-none bg-gray-50/50 rounded-lg focus-visible:ring-0 focus-visible:bg-gray-50"
            />
          </div>
          <div className="w-full md:w-48">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-11 border-none bg-gray-50/50 focus:ring-0 focus:ring-offset-0 text-gray-600 font-medium">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-gray-400" />
                  <SelectValue placeholder="Date Filter" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Weekly (Last 7 Days)</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="border-b border-gray-50 py-4 px-6">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-700">
              <div className="p-1.5 bg-gray-100 rounded-md">
                <ReceiptText className="size-4 text-gray-600" />
              </div>
              Transactions ({filteredTransactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200">
                    <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200">Transaction ID</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200">Date & Time</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200">Items</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200">Total</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200 text-center">Payment</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200">Cashier</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200 text-center whitespace-nowrap w-44">
                      <div className="flex items-center justify-center gap-2">
                        <Checkbox
                          checked={filteredTransactions.length > 0 && selectedTransactionIds.size === filteredTransactions.length}
                          disabled={filteredTransactions.length === 0}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                        />
                        <span className="ml-1">Actions</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200">
                  {paginated.map((t) => {
                    const itemCount = t.items?.length || 0;
                    return (
                      <TableRow
                        key={t.id}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <TableCell className="px-6 py-4 border-r border-gray-200 font-medium text-gray-800 text-sm">
                          <div className="flex flex-col">
                            <span className="font-bold">#{t.id.padStart(7, '0')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 border-r border-gray-200 text-sm text-gray-600 font-medium">
                          {formatDate(t.date)}
                        </TableCell>
                        <TableCell className="px-6 py-4 border-r border-gray-200 text-sm text-gray-500">
                          {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </TableCell>
                        <TableCell className="px-6 py-4 border-r border-gray-200 text-sm">
                          <span className={`font-bold ${t.status === 'voided' ? 'text-gray-400 line-through' : 'text-green-700'}`}>₱{t.total.toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="px-6 py-4 border-r border-gray-200 text-center">
                          {t.status === 'voided' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-[10px] font-black bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
                              VOIDED
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                              {t.paymentMethod || 'CASH'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4 border-r border-gray-200 text-sm text-gray-600 font-medium whitespace-nowrap">
                          {t.cashier || 'Zoe Owner'}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-left whitespace-nowrap w-44">
                          <div className="flex items-center justify-start gap-3">
                            <Checkbox
                              checked={selectedTransactionIds.has(t.id)}
                              onCheckedChange={() => toggleSelect(t.id)}
                            />
                            <button
                              className="flex items-center gap-1.5 text-xs font-bold text-[#1f2937] hover:text-black transition-colors min-w-[50px]"
                              onClick={() => { setSelectedTransaction(t); setIsDetailDialogOpen(true); }}
                            >
                              <Eye className="size-3.5" /> View
                            </button>

                            <div className="w-[70px] flex justify-start pl-3 ml-1 border-l-2 border-gray-100 h-5 items-center">
                              {t.status !== 'voided' && currentUser.role === 'admin' && (
                                <button
                                  className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setTransactionWaitingPasscode(t); }}
                                >
                                  <Trash2 className="size-3.5" /> Void
                                </button>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paginated.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-gray-400">
                        <ReceiptText className="size-10 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No transactions found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl">
            <div className="text-sm text-gray-500 font-medium">
              Showing <span className="text-gray-900 font-bold">{filteredTransactions.length === 0 ? 0 : startShowing}</span> to <span className="text-gray-900 font-bold">{endShowing}</span> of <span className="text-gray-900 font-bold">{filteredTransactions.length}</span> transactions
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="bg-white border-gray-200 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="size-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1 hidden sm:flex">
                {(() => {
                  const pages = [];
                  let start = Math.max(1, currentPage - 1);
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
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`size-8 p-0 font-bold ${currentPage === page ? "bg-gray-900 text-white" : "bg-white border-gray-200"}`}
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
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="bg-white border-gray-200 hover:bg-gray-100 disabled:opacity-50"
              >
                Next
                <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>

        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-sm font-mono p-0 border-none shadow-2xl bg-white overflow-hidden rounded-lg">
            <div className="w-full h-1 bg-gray-200" style={{ backgroundImage: 'linear-gradient(90deg, #f3f4f6 50%, transparent 50%)', backgroundSize: '10px 100%' }}></div>
            {selectedTransaction && (
              <div className="p-8">
                <div className="text-center mb-6">
                  <h2 className="text-lg font-black uppercase text-gray-900 leading-tight">Zoe Pharmacy & General Merchandise</h2>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold leading-tight max-w-[280px] mx-auto">
                    40 Mata Cor, Manlunas Sts., Vab Brgy, 183, Pasay City, Metro Manila
                  </p>
                </div>
                <div className="border-y border-dashed border-gray-300 py-3 text-[10px] space-y-1 mb-4 font-bold text-gray-700">
                  {selectedTransaction.status === 'voided' && (
                    <div className="flex justify-between items-center text-red-600 font-black py-1 px-2 mb-2 bg-red-50 border border-red-200 rounded text-[11px] tracking-wider">
                      <span>STATUS:</span>
                      <span>*** VOIDED TRANSACTION ***</span>
                    </div>
                  )}
                  <div className="flex justify-between"><span>TRANS ID:</span><span>{selectedTransaction.id}</span></div>
                  <div className="flex justify-between"><span>DATE:</span><span>{formatDate(selectedTransaction.date)}</span></div>
                  <div className="flex justify-between font-bold"><span>CASHIER:</span><span className="uppercase">{selectedTransaction.cashier || 'Zoe Owner'}</span></div>
                </div>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-xs font-bold border-b border-dashed pb-2"><span>ITEM NAME</span><span>TOTAL</span></div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(() => {
                      const consolidatedViewItems: Array<{ productName: string; quantity: number; price: number; isVoided: boolean }> = [];
                      const viewMap = new Map<string, { productName: string; quantity: number; price: number; isVoided: boolean }>();

                      (selectedTransaction.items || []).forEach((it: any) => {
                        const isVoided = it.status === 'voided';
                        const key = `${it.productId || it.productName}_${it.price}_${isVoided ? 'v' : 'a'}`;
                        const qty = Number(it.quantity || 0);
                        const price = Number(it.price || 0);

                        if (viewMap.has(key)) {
                          viewMap.get(key)!.quantity += qty;
                        } else {
                          const entry = {
                            productName: it.productName || 'Unknown',
                            quantity: qty,
                            price,
                            isVoided
                          };
                          viewMap.set(key, entry);
                          consolidatedViewItems.push(entry);
                        }
                      });

                      return consolidatedViewItems.map((it, i) => {
                        const isItemVoided = it.isVoided;
                        return (
                          <div key={i} className={`flex justify-between text-[11px] items-center ${isItemVoided ? 'text-red-500' : 'font-medium text-gray-800'}`}>
                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                              <span className={`truncate ${isItemVoided ? 'line-through text-gray-400' : ''}`}>
                                {it.productName} x{it.quantity}
                              </span>
                              {isItemVoided && (
                                <span className="no-underline inline-block text-[9px] font-black uppercase tracking-wider text-red-700 bg-red-100 px-1 py-0.5 rounded border border-red-200 shrink-0">
                                  VOIDED
                                </span>
                              )}
                            </div>
                            <span className={`shrink-0 font-bold ${isItemVoided ? 'line-through text-red-500 font-semibold' : 'text-gray-900'}`}>
                              {isItemVoided ? `-₱${(it.price * it.quantity).toFixed(2)}` : `₱${(it.price * it.quantity).toFixed(2)}`}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {(() => {
                  const items = selectedTransaction.items || [];
                  const voidedItems = items.filter((it: any) => it.status === 'voided');
                  const hasVoided = voidedItems.length > 0;
                  const originalTotal = items.reduce((sum: number, it: any) => sum + (it.price * it.quantity), 0);
                  const voidedTotal = voidedItems.reduce((sum: number, it: any) => sum + (it.price * it.quantity), 0);
                  const netTotal = selectedTransaction.status === 'voided' ? 0 : Number(selectedTransaction.total ?? Math.max(0, originalTotal - voidedTotal));
                  const amountReceived = Number(selectedTransaction.amountReceived ?? (hasVoided ? originalTotal : netTotal));
                  const changeDue = Number(selectedTransaction.change ?? Math.max(0, amountReceived - netTotal));

                  return (
                    <div className="border-t-2 border-dashed border-gray-900 pt-4 mb-6 space-y-2">
                      {hasVoided && (
                        <div className="space-y-1 pb-2 border-b border-dashed border-gray-200 text-xs">
                          <div className="flex justify-between text-gray-600 font-medium">
                            <span className="uppercase">Original Subtotal</span>
                            <span>₱{originalTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-red-600 font-bold">
                            <span className="uppercase">Refunded / Voided</span>
                            <span>-₱{voidedTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between text-sm font-black text-gray-900 uppercase">
                        <span>{hasVoided ? 'Net Order Total' : 'Grand Total'}</span>
                        <span>₱{netTotal.toFixed(2)}</span>
                      </div>

                      {/* Hide Cash Received and Change (Sukli) when void has occurred; retain when not voided */}
                      {hasVoided || selectedTransaction.status === 'voided' ? (
                        <div className="space-y-1 mt-3 pt-3 border-t border-dashed border-gray-200">
                          <div className="flex justify-between text-[11px] text-gray-600 font-medium">
                            <span className="uppercase">Payment Method</span>
                            <span className="font-bold uppercase">{selectedTransaction.paymentMethod || 'CASH'}</span>
                          </div>
                        </div>
                      ) : (
                        (!selectedTransaction.paymentMethod || selectedTransaction.paymentMethod.toLowerCase() === 'cash' || selectedTransaction.amountReceived != null) ? (
                          <div className="space-y-1 mt-3 pt-3 border-t border-dashed border-gray-200">
                            <div className="flex justify-between text-[11px] text-gray-600 font-medium">
                              <span className="uppercase">Cash Received</span>
                              <span>₱{amountReceived.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-black text-blue-700 bg-blue-50/50 p-2 rounded -mx-2 mt-1">
                              <span className="uppercase tracking-tighter">Change (Sukli)</span>
                              <span>₱{changeDue.toFixed(2)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1 mt-3 pt-3 border-t border-dashed border-gray-200">
                            <div className="flex justify-between text-[11px] text-gray-600 font-medium">
                              <span className="uppercase">Payment Method</span>
                              <span className="font-bold uppercase">{selectedTransaction.paymentMethod}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-gray-800">
                              <span className="uppercase">Amount Paid</span>
                              <span>₱{netTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  );
                })()}

                <div className="text-center space-y-1 mb-6 text-gray-800">
                  <p className="font-bold text-xs">THANK YOU FOR YOUR TRUST!</p>
                  <p className="text-[9px]">--- NO REFUND WITHOUT TRANSACTION DETAILS ---</p>
                  <p className="text-[9px] italic text-gray-500">This is not an official transaction record.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="border-gray-300 hover:bg-gray-100 rounded-none h-11 uppercase text-[10px] font-bold tracking-widest flex items-center justify-center gap-1.5"
                    onClick={() => generatePDF(selectedTransaction)}
                  >
                    <Download className="size-3.5" />
                    Download Receipt
                  </Button>
                  <Button
                    className="bg-gray-900 hover:bg-black text-white rounded-none h-11 uppercase text-[10px] font-bold tracking-widest"
                    onClick={() => setIsDetailDialogOpen(false)}
                  >
                    Close Record
                  </Button>
                </div>
              </div>
            )}
            <div className="w-full h-2 bg-gray-200" style={{ backgroundImage: 'linear-gradient(45deg, transparent 33.333%, #fff 33.333%, #fff 66.666%, transparent 66.666%), linear-gradient(-45deg, transparent 33.333%, #fff 33.333%, #fff 66.666%, transparent 66.666%)', backgroundSize: '12px 24px' }}></div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!transactionToVoid} onOpenChange={(open) => !open && setTransactionToVoid(null)}>
          <DialogContent className="max-w-lg bg-white border-0 shadow-2xl p-6 rounded-2xl flex flex-col max-h-[90vh]">
            {(() => {
              const activeItems = (transactionToVoid?.items || []).filter(it => it.status !== 'voided');
              const totalItemsCount = activeItems.length;
              const selectedCount = selectedItemIndicesToVoid.size;

              const getVoidQty = (idx: number, maxQty: number) => {
                const q = voidQuantities[idx];
                if (q == null) return maxQty;
                return Math.min(maxQty, Math.max(1, q));
              };

              const voidedTotal = activeItems.reduce((sum, it, idx) => {
                if (!selectedItemIndicesToVoid.has(idx)) return sum;
                const q = getVoidQty(idx, it.quantity);
                return sum + (it.price * q);
              }, 0);

              const totalUnitsToVoid = activeItems.reduce((sum, it, idx) => {
                if (!selectedItemIndicesToVoid.has(idx)) return sum;
                return sum + getVoidQty(idx, it.quantity);
              }, 0);

              const originalTotal = transactionToVoid?.total || 0;
              const remainingTotal = Math.max(0, originalTotal - voidedTotal);

              // Fully voided order only if all items checked AND each void qty equals full qty
              const isAllFullVoid = totalItemsCount > 0 && selectedCount === totalItemsCount && activeItems.every((it, idx) => {
                return getVoidQty(idx, it.quantity) === it.quantity;
              });
              const isNoneChecked = selectedCount === 0;

              return (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="size-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
                    <Trash2 className="size-7 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 leading-tight mb-1">
                    Void Items in Transaction #{transactionToVoid?.id.padStart(7, '0')}
                  </h2>
                  <p className="text-xs text-gray-500 px-2 mb-3">
                    Check items to void and adjust the quantity to return. Voided units will be refunded and restored to inventory stock.
                  </p>

                  {/* Checklist Header with Select All */}
                  <div className="w-full flex items-center justify-between py-2 px-1 mb-2 border-b border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 select-none">
                      <input
                        type="checkbox"
                        checked={totalItemsCount > 0 && selectedCount === totalItemsCount}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItemIndicesToVoid(new Set(activeItems.map((_, i) => i)));
                            const allQtys: Record<number, number> = {};
                            activeItems.forEach((it, i) => {
                              allQtys[i] = it.quantity;
                            });
                            setVoidQuantities(allQtys);
                          } else {
                            setSelectedItemIndicesToVoid(new Set());
                          }
                        }}
                        className="size-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer accent-red-600"
                      />
                      <span>Select All ({totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'})</span>
                    </label>
                    <span className="text-xs font-bold text-gray-600">
                      {selectedCount} of {totalItemsCount} selected
                    </span>
                  </div>

                  {/* Transaction Items Checklist */}
                  <div className="w-full text-left space-y-2 mb-3 overflow-y-auto max-h-56 pr-1">
                    {activeItems.map((it, i) => {
                      const isChecked = selectedItemIndicesToVoid.has(i);
                      const currentVoidQty = getVoidQty(i, it.quantity);
                      const isPartialQty = currentVoidQty < it.quantity;

                      return (
                        <div
                          key={i}
                          onClick={() => {
                            setSelectedItemIndicesToVoid(prev => {
                              const next = new Set(prev);
                              if (next.has(i)) {
                                next.delete(i);
                              } else {
                                next.add(i);
                                if (!voidQuantities[i]) {
                                  setVoidQuantities(q => ({ ...q, [i]: it.quantity }));
                                }
                              }
                              return next;
                            });
                          }}
                          className={`flex flex-col p-3 rounded-xl border-2 text-sm cursor-pointer transition-all duration-150 select-none ${
                            isChecked
                              ? 'bg-red-50 border-red-500 shadow-md ring-2 ring-red-200'
                              : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 pr-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // handled by parent onClick
                                className="size-5 rounded border-gray-300 text-red-600 focus:ring-red-500 pointer-events-none accent-red-600 cursor-pointer"
                              />
                              <div className="flex flex-col min-w-0 text-left">
                                <span className={`truncate text-sm font-bold ${isChecked ? 'text-red-950 font-black' : 'text-gray-900'}`}>
                                  {it.productName}
                                </span>
                                <span className={`text-xs ${isChecked ? 'text-red-700 font-semibold' : 'text-gray-500 font-medium'}`}>
                                  ₱{it.price.toFixed(2)} × {it.quantity} {it.quantity === 1 ? 'unit' : 'units'}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0 pl-2">
                              <span className={`font-black text-sm whitespace-nowrap ${isChecked ? 'text-red-600' : 'text-gray-900'}`}>
                                ₱{(it.price * (isChecked ? currentVoidQty : it.quantity)).toFixed(2)}
                              </span>
                              {isChecked && (
                                <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-100 px-1.5 py-0.5 rounded mt-0.5 border border-red-200">
                                  {isPartialQty ? `VOID ${currentVoidQty} OF ${it.quantity}` : 'VOID ALL'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quantity Stepper (Shown when item is checked and bought quantity > 1) */}
                          {isChecked && it.quantity > 1 && (
                            <div
                              className="flex items-center justify-between mt-2.5 pt-2 border-t border-red-200/80"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-gray-700">Quantity to void:</span>
                                {isPartialQty && (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                    Remaining: {it.quantity - currentVoidQty}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 bg-white border border-red-300 rounded-lg p-0.5 shadow-sm">
                                <button
                                  type="button"
                                  className="size-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-800 font-black text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  disabled={currentVoidQty <= 1}
                                  onClick={() => {
                                    setVoidQuantities(prev => ({
                                      ...prev,
                                      [i]: Math.max(1, currentVoidQty - 1)
                                    }));
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={it.quantity}
                                  value={currentVoidQty}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val)) {
                                      setVoidQuantities(prev => ({
                                        ...prev,
                                        [i]: Math.max(1, Math.min(it.quantity, val))
                                      }));
                                    }
                                  }}
                                  className="w-10 text-center text-xs font-black text-gray-900 border-0 focus:ring-0 p-0"
                                />
                                <button
                                  type="button"
                                  className="size-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-800 font-black text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  disabled={currentVoidQty >= it.quantity}
                                  onClick={() => {
                                    setVoidQuantities(prev => ({
                                      ...prev,
                                      [i]: Math.min(it.quantity, currentVoidQty + 1)
                                    }));
                                  }}
                                >
                                  +
                                </button>
                                <span className="text-[11px] text-gray-500 font-medium pr-1.5">
                                  / {it.quantity}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Financial Summary */}
                  <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3 space-y-1 text-xs text-left">
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Current Order Total:</span>
                      <span className="font-semibold text-gray-900">₱{originalTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-700 font-bold border-t border-gray-200 pt-1.5">
                      <span>Refund & Stock Return:</span>
                      <span className="text-sm font-black">-₱{voidedTotal.toFixed(2)} ({totalUnitsToVoid} {totalUnitsToVoid === 1 ? 'unit' : 'units'})</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-700 font-medium">
                      <span>Remaining Order Total:</span>
                      <span className="font-black text-gray-900">₱{remainingTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div className="w-full mb-2">
                    {isAllFullVoid ? (
                      <div className="bg-red-50 border border-red-200 text-red-800 text-[11px] font-bold px-3 py-1.5 rounded-lg text-center">
                        FULL VOID: The entire transaction will be cancelled and marked as VOIDED.
                      </div>
                    ) : isNoneChecked ? (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-center">
                        Please check at least 1 item to void.
                      </div>
                    ) : (
                      <div className="bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-center">
                        PARTIAL VOID: Only selected item quantities will be refunded and restored to stock.
                      </div>
                    )}
                  </div>

                  {/* Swipe-to-Void Slider */}
                  <div className="w-full pt-1 pb-2 mt-auto">
                    {transactionToVoid && (
                      <SwipeToVoid
                        disabled={isNoneChecked || isVoiding}
                        isProcessing={isVoiding}
                        label={
                          isAllFullVoid
                            ? "SWIPE TO VOID ENTIRE ORDER >>>"
                            : `SWIPE TO VOID ${totalUnitsToVoid} UNIT(S) (-₱${voidedTotal.toFixed(2)}) >>>`
                        }
                        onVoid={() => {
                          const id = transactionToVoid.id;
                          const selectedItemsToVoid = activeItems
                            .map((it, idx) => ({ it, idx }))
                            .filter(({ idx }) => selectedItemIndicesToVoid.has(idx))
                            .map(({ it, idx }) => ({
                              ...it,
                              quantity: getVoidQty(idx, it.quantity)
                            }));
                          handleVoidTransaction(id, selectedItemsToVoid, isAllFullVoid);
                        }}
                      />
                    )}
                  </div>

                  <button
                    onClick={() => setTransactionToVoid(null)}
                    className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors uppercase tracking-widest mt-1"
                  >
                    Cancel Action
                  </button>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Owner Passcode Authorization for Void (Prompted FIRST before Swipe) */}
        <OwnerPasscodeModal
          isOpen={!!transactionWaitingPasscode}
          actionTitle={`Void Transaction #${transactionWaitingPasscode?.id.padStart(7, '0') || ''}`}
          actionDescription={`Owner authorization required before voiding ₱${transactionWaitingPasscode?.total.toFixed(2) || '0.00'} and restoring inventory stock.`}
          onSuccess={() => {
            if (transactionWaitingPasscode) {
              const t = transactionWaitingPasscode;
              setTransactionWaitingPasscode(null);
              setTransactionToVoid(t);
            }
          }}
          onClose={() => setTransactionWaitingPasscode(null)}
        />
      </div>
    </ErrorBoundary>
  );
}
