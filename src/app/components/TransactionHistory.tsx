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

interface TransactionHistoryProps {
  currentUser: User;
}

const SwipeToVoid = ({ onVoid }: { onVoid: () => void }) => {
  const [val, setVal] = useState(0);
  return (
    <div className="relative w-full h-12 bg-red-100 rounded-md overflow-hidden flex items-center shadow-inner mt-4 border border-red-200">
      <div className="absolute inset-0 flex items-center justify-center text-sm font-black tracking-widest text-red-800 pointer-events-none opacity-80 decoration-0">
        SWIPE TO CONFIRM VOID &gt;&gt;&gt;
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
        onChange={(e) => {
          const v = parseInt(e.target.value);
          setVal(v);
          if (v > 92) { onVoid(); setVal(0); }
        }}
        onMouseUp={() => setVal(0)}
        onPointerUp={() => setVal(0)}
        onTouchEnd={() => setVal(0)}
        className="absolute inset-0 w-full opacity-0 cursor-ew-resize m-0 p-0"
      />
      <div
        className="absolute top-0 bottom-0 w-14 bg-red-600 flex items-center justify-center pointer-events-none py-1"
        style={{ left: `calc(${val}% - ${(val / 100) * 56}px)` }}
      >
        <Trash2 className="size-5 text-white" />
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
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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

  const handleVoidTransaction = async (id: string) => {
    try {
      const response = await fetch('/api/transactions.php', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Name': currentUser.name,
        },
        body: JSON.stringify({ id, action: 'void' }),
      });

      if (!response.ok) throw new Error('Failed to void transaction');

      toast.success(`Transaction #${id} voided successfully`);
      setTransactionToVoid(null);

      setTransactions(prev => prev.map(t =>
        t.id === id ? { ...t, status: 'voided' } : t
      ));
    } catch (error) {
      console.error("Void Error:", error);
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

  const generatePDF = (t: Transaction) => {
    // Calculate required height: Base height (approx 120mm) + 10mm per item
    const itemsCount = t.items.length;
    // Increased base to 150mm and per-item to 12mm to provide plenty of space
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
    doc.text(`CASHIER: ${(t.cashier || 'ADMINISTRATOR').toUpperCase()}`, 4, y); y += 8;

    doc.text('----------------------------------', 40, y, { align: 'center' }); y += 6;

    doc.text('ITEM DESCRIPTION', 4, y);
    doc.text('PRICE', 76, y, { align: 'right' }); y += 6;

    t.items.forEach(it => {
      const productName = (it.productName || 'Unknown').substring(0, 20).toUpperCase();
      doc.text(productName, 4, y);
      doc.text(`P${(it.price * it.quantity).toFixed(2)}`, 76, y, { align: 'right' }); y += 4;
      doc.text(`${it.quantity} units x P${it.price.toFixed(2)}`, 4, y); y += 6;
    });

    doc.text('__________________________________', 40, y, { align: 'center' }); y += 8;

    doc.setFont("courier", "bold");
    doc.text(`TOTAL AMOUNT`, 4, y);
    doc.text(`P${t.total.toFixed(2)}`, 76, y, { align: 'right' }); y += 8;

    doc.setFont("courier", "normal");
    const amountReceived = t.amountReceived || t.total;
    const change = t.change || 0;

    doc.text(`CASH RECEIVED`, 4, y);
    doc.text(`P${amountReceived.toFixed(2)}`, 76, y, { align: 'right' }); y += 6;
    doc.setFont("courier", "bold");
    doc.text(`CHANGE DUE`, 4, y);
    doc.text(`P${change.toFixed(2)}`, 76, y, { align: 'right' }); y += 10;

    doc.text(`THANK YOU FOR YOUR TRUST!`, 40, y, { align: 'center' }); y += 6;
    doc.setFontSize(8);
    doc.setFont("courier", "normal");
    doc.text(`--- NO REFUND WITHOUT TRANSACTION DETAILS ---`, 40, y, { align: 'center' }); y += 4;
    doc.setFont("courier", "italic");
    doc.text(`This is not an official transaction record.`, 40, y, { align: 'center' });

    doc.save(`receipt_${t.id}.pdf`);
  };

  const exportAllPDF = () => {
    const transactionsToExport = selectedTransactionIds.size > 0
      ? filteredTransactions.filter(t => selectedTransactionIds.has(t.id))
      : filteredTransactions;

    if (transactionsToExport.length === 0) return;

    // We'll create the document with the height of the first transaction, 
    // but the actual page sizes will be added individually in the loop.
    // Increased base height for safety
    const firstItemsCount = transactionsToExport[0].items.length;
    const firstHeight = 150 + (firstItemsCount * 12);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [80, firstHeight] });

    transactionsToExport.forEach((t, index) => {
      if (index > 0) {
        const itemsCount = t.items.length;
        const estimatedHeight = 150 + (itemsCount * 12);
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
      doc.text(`CASHIER: ${(t.cashier || 'ADMINISTRATOR').toUpperCase()}`, 4, y); y += 8;

      doc.text('----------------------------------', 40, y, { align: 'center' }); y += 6;

      doc.text('ITEM DESCRIPTION', 4, y);
      doc.text('PRICE', 76, y, { align: 'right' }); y += 6;

      t.items.forEach((it: any) => {
        const productName = (it.productName || 'Unknown').substring(0, 20).toUpperCase();
        doc.text(productName, 4, y);
        doc.text(`P${(it.price * it.quantity).toFixed(2)}`, 76, y, { align: 'right' }); y += 4;
        doc.text(`${it.quantity} units x P${it.price.toFixed(2)}`, 4, y); y += 6;
      });

      doc.text('__________________________________', 40, y, { align: 'center' }); y += 8;

      doc.setFont("courier", "bold");
      doc.text(`TOTAL AMOUNT`, 4, y);
      doc.text(`P${t.total.toFixed(2)}`, 76, y, { align: 'right' }); y += 8;

      doc.setFont("courier", "normal");
      const amountReceived = t.amountReceived || t.total;
      const change = t.change || 0;

      doc.text(`CASH RECEIVED`, 4, y);
      doc.text(`P${amountReceived.toFixed(2)}`, 76, y, { align: 'right' }); y += 6;
      doc.setFont("courier", "bold");
      doc.text(`CHANGE DUE`, 4, y);
      doc.text(`P${change.toFixed(2)}`, 76, y, { align: 'right' }); y += 10;

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
                    <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200 text-center whitespace-nowrap w-56">
                      <div className="flex items-center justify-center gap-2">
                        <Checkbox
                          checked={selectedTransactionIds.size === filteredTransactions.length && filteredTransactions.length > 0}
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
                        <TableCell className="px-6 py-4 text-left whitespace-nowrap w-56">
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
                            <button
                              className="flex items-center gap-1.5 text-xs font-bold text-[#3b82f6] hover:text-blue-700 transition-colors min-w-[70px]"
                              onClick={(e) => { e.stopPropagation(); generatePDF(t); }}
                            >
                              <Download className="size-3.5" /> Download
                            </button>

                            <div className="w-[70px] flex justify-start pl-3 ml-1 border-l-2 border-gray-100 h-5 items-center">
                              {t.status !== 'voided' && currentUser.role === 'admin' && (
                                <button
                                  className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setTransactionToVoid(t); }}
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
                  <div className="flex justify-between"><span>TRANS ID:</span><span>{selectedTransaction.id}</span></div>
                  <div className="flex justify-between"><span>DATE:</span><span>{formatDate(selectedTransaction.date)}</span></div>
                  <div className="flex justify-between font-bold"><span>CASHIER:</span><span className="uppercase">{selectedTransaction.cashier || 'Admin'}</span></div>
                </div>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-xs font-bold border-b border-dashed pb-2"><span>ITEM NAME</span><span>TOTAL</span></div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {selectedTransaction.items.map((it: any, i: number) => (
                      <div key={i} className="flex justify-between text-[11px] font-medium">
                        <span>{it.productName} x{it.quantity}</span>
                        <span>₱{(it.price * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t-2 border-dashed border-gray-900 pt-4 mb-6">
                  <div className="flex justify-between text-sm font-black text-gray-900 uppercase">
                    <span>Grand Total</span>
                    <span>₱{selectedTransaction.total.toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-center space-y-1 mb-6 text-gray-800">
                  <p className="font-bold text-xs">THANK YOU FOR YOUR TRUST!</p>
                  <p className="text-[9px]">--- NO REFUND WITHOUT TRANSACTION DETAILS ---</p>
                  <p className="text-[9px] italic text-gray-500">This is not an official transaction record.</p>
                </div>
                <Button
                  className="w-full bg-gray-900 hover:bg-black text-white rounded-none h-11 uppercase text-[10px] font-bold tracking-widest"
                  onClick={() => setIsDetailDialogOpen(false)}
                >
                  Close Record
                </Button>
              </div>
            )}
            <div className="w-full h-2 bg-gray-200" style={{ backgroundImage: 'linear-gradient(45deg, transparent 33.333%, #fff 33.333%, #fff 66.666%, transparent 66.666%), linear-gradient(-45deg, transparent 33.333%, #fff 33.333%, #fff 66.666%, transparent 66.666%)', backgroundSize: '12px 24px' }}></div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!transactionToVoid} onOpenChange={(open) => !open && setTransactionToVoid(null)}>
          <DialogContent className="max-w-md bg-white border-0 shadow-2xl p-6 rounded-2xl flex flex-col max-h-[90vh]">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="size-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="size-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight mb-1">
                Void Transaction #{transactionToVoid?.id.padStart(7, '0')}?
              </h2>
              <p className="text-sm text-gray-500 px-4 mb-4">
                This action will instantly cancel the transaction, restoring exact stock levels for {transactionToVoid?.items.length} items to inventory. The total ₱{transactionToVoid?.total.toFixed(2)} will be subtracted from sales.
              </p>

              {/* Transaction Items Detail List */}
              <div className="w-full text-left bg-gray-50 rounded-lg p-4 mb-4 border border-gray-100 overflow-y-auto max-h-40">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Transaction Details</h3>
                <div className="space-y-2">
                  {transactionToVoid?.items.map((it, i) => (
                    <div key={i} className="flex justify-between items-center text-sm border-b border-gray-200 border-dashed pb-2 last:border-0 last:pb-0">
                      <span className="font-medium text-gray-700">{it.productName} <span className="text-gray-400 text-xs">x{it.quantity}</span></span>
                      <span className="font-bold text-gray-900">₱{(it.price * it.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full pt-2 pb-2 mt-auto">
                {transactionToVoid && <SwipeToVoid onVoid={() => handleVoidTransaction(transactionToVoid.id)} />}
              </div>

              <button
                onClick={() => setTransactionToVoid(null)}
                className="text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors uppercase tracking-widest mt-2"
              >
                Cancel Action
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
