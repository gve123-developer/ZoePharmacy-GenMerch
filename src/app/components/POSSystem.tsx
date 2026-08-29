import { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { speak } from '@/app/utils/voiceUtils';
import { User, Product, Transaction } from '@/app/App';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { toast } from 'sonner';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, FileText, Mic, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { logAuditAction } from '@/app/utils/auditUtils';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';

interface POSSystemProps {
  currentUser: User;
  products: Product[];
  onProductsChange: (products: Product[]) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export function POSSystem({ currentUser, products, onProductsChange }: POSSystemProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);


  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice search is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript.replace(/[.?!]$/g, '')); // Remove trailing punctuation
      setIsListening(false);
      toast.success(`Searching for: ${transcript}`);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied.');
      } else {
        toast.error('Voice search error. Please try again.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const todayStart = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

  const getDaysRemaining = (expiryDate: string | undefined): number | undefined => {
    if (!expiryDate) return undefined;
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - todayStart.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // No local state for products needed

  const filteredProducts = useMemo(() => {
    return products
      .filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.sku.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        // Sort by category first: Pharmaceutical (0) then Non-pharmaceutical (1)
        const catPriorityA = a.category === 'Pharmaceutical' ? 0 : 1;
        const catPriorityB = b.category === 'Pharmaceutical' ? 0 : 1;

        if (catPriorityA !== catPriorityB) {
          return catPriorityA - catPriorityB;
        }

        // Secondary sort by ID descending (newest first)
        return Number(b.id) - Number(a.id);
      });
  }, [products, searchQuery, filterCategory]);

  const addToCart = (product: Product) => {
    const totalAvailable = Number(product.quantity) + Number(product.newStockQuantity || 0);

    if (totalAvailable <= 0) {
      toast.error('Product is out of stock');
      return;
    }

    const days = getDaysRemaining(product.expiryDate);
    if (days !== undefined && days < 0) {
      toast.error('This product is expired');
      return;
    }

    const existingItem = cart.find(item => item.product.id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= totalAvailable) {
        toast.error('Not enough stock available');
        return;
      }
      setCart([
        { ...existingItem, quantity: existingItem.quantity + 1 },
        ...cart.filter(item => item.product.id !== product.id)
      ]);
    } else {
      setCart([{ product, quantity: 1 }, ...cart]);
    }
    toast.success('Added to cart');
    setSearchQuery('');
  };

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    if (newQuantity < 0) return;

    const totalAvailable = Number(item.product.quantity) + Number(item.product.newStockQuantity || 0);

    if (newQuantity > totalAvailable) {
      toast.error('Not enough stock available');
      return;
    }

    setCart([
      { ...item, quantity: newQuantity },
      ...cart.filter(i => i.product.id !== productId)
    ]);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  const calculateChange = () => {
    const received = parseFloat(amountReceived);
    if (isNaN(received)) return 0;
    return received - calculateTotal();
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const receivedNum = parseFloat(amountReceived || '0');
    if (paymentMethod === 'cash') {
      if (isNaN(receivedNum) || receivedNum < calculateTotal()) {
        toast.error('Insufficient payment amount');
        return;
      }
    }

    // Prepare data for API
    const formData = new FormData();
    const cartData = cart.map(item => ({
      id: item.product.id,
      qty: item.quantity,
      price: item.product.price
    }));
    formData.append('cart', JSON.stringify(cartData));
    formData.append('payment_method', paymentMethod);
    formData.append('total', calculateTotal().toString());
    formData.append('cashier_id', currentUser.id);
    if (paymentMethod === 'cash') {
      formData.append('amount_received', receivedNum.toString());
      formData.append('change', calculateChange().toString());
    }

    try {
      const response = await fetch('/api/save_transaction.php', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      if (data.success) {
        // Create local transaction object for the UI summary
        const transaction: Transaction = {
          id: data.id.toString(),
          date: new Date().toISOString(),
          items: cart.map(item => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            cost: item.product.cost,
          })),
          total: calculateTotal(),
          paymentMethod,
          cashier: currentUser.name,
          amountReceived: paymentMethod === 'cash' ? receivedNum : undefined,
          change: paymentMethod === 'cash' ? (receivedNum - calculateTotal()) : undefined,
        };

        // Update inventory locally (App.tsx will refetch soon anyway, but this keeps UI snappy)
        const updatedProducts = products.map(product => {
          const cartItem = cart.find(item => item.product.id === product.id);
          if (cartItem) {
            let totalToDeduct = cartItem.quantity;
            let currentOld = product.quantity;
            let currentNew = product.newStockQuantity || 0;

            // Deduct from Old first
            const takeFromOld = Math.min(totalToDeduct, currentOld);
            currentOld -= takeFromOld;
            totalToDeduct -= takeFromOld;

            // Deduct from New if anything left
            const takeFromNew = Math.min(totalToDeduct, currentNew);
            currentNew -= takeFromNew;

            // Auto-Rotate: If Old is now 0, promote New to Old
            if (currentOld <= 0 && currentNew > 0) {
              return {
                ...product,
                quantity: currentNew,
                expiryDate: product.newStockExpiry || product.expiryDate,
                newStockQuantity: 0,
                newStockExpiry: undefined
              };
            }

            return { ...product, quantity: currentOld, newStockQuantity: currentNew };
          }
          return product;
        });

        onProductsChange(updatedProducts);
        setCart([]);
        setAmountReceived('');
        setCompletedTransaction(transaction);
        toast.success('Transaction completed successfully!');
        speak('Transaction complete');
        setSearchQuery('');

        // Selection of item summary for audit
        const itemSummary = transaction.items
          .map(i => `${i.productName} x${i.quantity}`)
          .join(', ');
        logAuditAction(
          currentUser.name,
          'POS Sale',
          `Completed sale #${data.id}. Total: ₱${transaction.total.toFixed(2)} | Items: ${itemSummary}`
        );
      } else {
        toast.error('Failed to save transaction: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error connecting to transaction API');
    }
  };

  const clearCart = () => {
    setCart([]);
    setAmountReceived('');
  };

  const generatePDF = (t: Transaction) => {
    // Calculate required height: Base height (approx 150mm) + 12mm per item
    const itemsCount = t.items.length;
    const estimatedHeight = 150 + (itemsCount * 12);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [80, estimatedHeight] });

    // Draw a visual Philippine peso sign while preserving the original Courier receipt design
    const addPesoStrokes = (pX: number, yPos: number) => {
      doc.setLineWidth(0.18);
      doc.line(pX - 0.1, yPos - 1.55, pX + 2.0, yPos - 1.55);
      doc.line(pX - 0.1, yPos - 0.85, pX + 2.0, yPos - 0.85);
    };

    const drawPesoRight = (
      amount: string,
      xRight: number,
      yPos: number
    ) => {
      const text = `P${amount}`;
      doc.text(text, xRight, yPos, { align: 'right' });

      const totalWidth = doc.getTextWidth(text);
      const pX = xRight - totalWidth;
      addPesoStrokes(pX, yPos);
    };

    const drawPesoInline = (
      prefix: string,
      amount: string,
      xPos: number,
      yPos: number
    ) => {
      const text = `${prefix}P${amount}`;
      doc.text(text, xPos, yPos);

      const prefixWidth = doc.getTextWidth(prefix);
      addPesoStrokes(xPos + prefixWidth, yPos);
    };

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
    const dateStr = new Date(t.date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    doc.text(`DATE: ${dateStr}`, 4, y); y += 4;
    doc.text(`CASHIER: ${(t.cashier || 'ADMINISTRATOR').toUpperCase()}`, 4, y); y += 8;

    doc.text('----------------------------------', 40, y, { align: 'center' }); y += 6;

    doc.text('ITEM DESCRIPTION', 4, y);
    doc.text('PRICE', 76, y, { align: 'right' }); y += 6;

    t.items.forEach(it => {
      const productName = (it.productName || 'Unknown').substring(0, 20).toUpperCase();
      doc.text(productName, 4, y);
      drawPesoRight((it.price * it.quantity).toFixed(2), 76, y); y += 4;
      drawPesoInline(`${it.quantity} units x `, it.price.toFixed(2), 4, y); y += 6;
    });

    doc.text('__________________________________', 40, y, { align: 'center' }); y += 8;

    doc.setFont("courier", "bold");
    doc.text(`TOTAL AMOUNT`, 4, y);
    drawPesoRight(t.total.toFixed(2), 76, y); y += 8;

    doc.setFont("courier", "normal");
    const amountReceivedVal = t.amountReceived || t.total;
    const changeVal = t.change || 0;

    doc.text(`CASH RECEIVED`, 4, y);
    drawPesoRight(amountReceivedVal.toFixed(2), 76, y); y += 6;
    doc.setFont("courier", "bold");
    doc.text(`CHANGE DUE`, 4, y);
    drawPesoRight(changeVal.toFixed(2), 76, y); y += 10;

    doc.text(`THANK YOU FOR YOUR TRUST!`, 40, y, { align: 'center' }); y += 6;
    doc.setFontSize(8);
    doc.setFont("courier", "normal");
    doc.text(`--- NO REFUND WITHOUT TRANSACTION DETAILS ---`, 40, y, { align: 'center' }); y += 4;
    doc.setFont("courier", "italic");
    doc.text(`This is not an official transaction record.`, 40, y, { align: 'center' });

    doc.save(`receipt_${t.id}.pdf`);
  };

  return (
    <ErrorBoundary fallbackTitle="POS System Module Error">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Point of Sale</h2>
          <p className="text-sm text-gray-500 mt-1">Process sales transactions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Product Selection */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <ErrorBoundary fallbackTitle="Product Selection Error">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                      <Input
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`absolute right-1 top-1/2 transform -translate-y-1/2 size-8 rounded-full ${isListening ? 'text-red-600 bg-red-50 animate-pulse' : 'text-gray-400'}`}
                        onClick={startVoiceSearch}
                        title="Voice Search"
                      >
                        <Mic className={`size-4 ${isListening ? 'fill-red-600' : ''}`} />
                      </Button>
                    </div>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className=";w-full md:w-56">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="Pharmaceutical">Pharmaceutical</SelectItem>
                        <SelectItem value="Non-pharmaceutical">Non-pharmaceutical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                    {filteredProducts.map((product) => (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:shadow-md transition-all border"
                        style={{
                          backgroundColor: product.category === 'Pharmaceutical' ? '#fafff0' : '#f0f7ff',
                          borderColor: product.category === 'Pharmaceutical' ? '#8bb300' : '#4169E1'
                        }}
                        onClick={() => addToCart(product)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-gray-900">{product.name}</h4>
                                {(() => {
                                  const days = getDaysRemaining(product.expiryDate);
                                  if (days !== undefined) {
                                    if (days < 0) return <Badge variant="destructive" className="h-5 px-1.5 text-[10px] uppercase font-black animate-pulse">Expired</Badge>;
                                    if (days <= 30) return <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-bold border-orange-500 text-orange-600 bg-orange-50">Expiring Soon</Badge>;
                                  }
                                  return null;
                                })()}
                              </div>
                              <p className="text-xs text-gray-500 font-mono tracking-tighter">{product.sku}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {(() => {
                                const total = Number(product.quantity) + Number(product.newStockQuantity || 0);
                                return (
                                  <Badge variant={total > 0 ? 'default' : 'destructive'} className="font-black text-[10px] uppercase tracking-widest">
                                    {total > 0 ? `${total} TOTAL STOCK` : 'OUT OF STOCK'}
                                  </Badge>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="flex justify-between items-center mt-2">
                            <span className="text-lg font-black text-blue-700">₱{product.price.toFixed(2)}</span>
                            <Button size="sm" variant="outline" disabled={(Number(product.quantity) + Number(product.newStockQuantity || 0)) <= 0} className="border-2 border-blue-100 hover:bg-blue-600 hover:text-white transition-all">
                              <Plus className="size-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="col-span-2 text-center py-8 text-gray-500">
                        No products found
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </ErrorBoundary>
          </div>

          {/* Cart and Checkout - IMAGE MATCHED DESIGN */}
          <div className="lg:col-span-12 xl:col-span-4 h-fit lg:sticky lg:top-6">
            <ErrorBoundary fallbackTitle="Order Summary Error">
              <Card className="flex flex-col max-h-[calc(100vh-100px)] border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white">
                <CardHeader className="bg-[#f0f7ff] border-b border-blue-50 py-3 px-5">
                  <CardTitle className="flex items-center gap-2 text-[#2b59c3]">
                    <ShoppingCart className="size-5" />
                    <span className="text-lg font-bold">Order Summary</span>
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 overflow-hidden p-5 space-y-6">
                  {/* Cart Items Area - Scrollable */}
                  <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar">
                    {cart.length > 0 ? (
                      <>
                        {/* Customer Purchase Info Box */}
                        <div className="bg-[#eff6ff] p-4 rounded-xl border border-blue-100 space-y-2">
                          <div className="flex items-center gap-2 text-[#1e40af]">
                            <FileText className="size-4" />
                            <h3 className="font-bold text-sm">Customer Purchase</h3>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[11px] text-gray-500 font-medium">Order Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                            <p className="text-[11px] text-gray-500 font-medium">Cashier: {currentUser.name}</p>
                          </div>
                        </div>

                        {/* Items Section */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ITEMS</h4>
                          <div className="space-y-3">
                            {cart.map((item, index) => (
                              <div key={item.product.id} className="relative bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1 min-w-0 pr-6">
                                    <h4 className="font-bold text-sm text-gray-800 truncate uppercase tracking-tight">{item.product.name}</h4>
                                    <p className="text-[10px] text-gray-400 font-mono">{item.product.sku}</p>
                                    <p className="text-[11px] text-[#2b59c3] font-medium mt-1">₱{item.product.price.toFixed(2)} each</p>
                                  </div>
                                  <button
                                    onClick={() => removeFromCart(item.product.id)}
                                    className="text-red-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </div>

                                <div className="flex items-end justify-between gap-4 mt-4">
                                  <div className="flex items-center gap-1 border border-gray-100 rounded-lg p-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => updateCartQuantity(item.product.id, Math.max(0, item.quantity - 1))}
                                      className="size-7 border border-gray-100 rounded-md"
                                    >
                                      <Minus className="size-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      value={String(item.quantity)}
                                      onChange={(e) => updateCartQuantity(item.product.id, Number(e.target.value) || 0)}
                                      className="w-12 h-7 border-0 bg-gray-50 text-center font-bold text-xs p-0 focus-visible:ring-0"
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                                      className="size-7 border border-gray-100 rounded-md"
                                    >
                                      <Plus className="size-3" />
                                    </Button>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] text-gray-400 font-medium">Subtotal</p>
                                    <p className="font-black text-base text-gray-900 leading-none">
                                      ₱{(item.product.price * item.quantity).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                        <ShoppingCart className="size-12 mb-4 text-gray-400" />
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Cart is empty</p>
                      </div>
                    )}
                  </div>

                  {/* BOTTOM SECTION: Fixed (Total + Payment + Actions) */}
                  {cart.length > 0 && (
                    <div className="flex-shrink-0 bg-white border-t border-gray-100 p-5 space-y-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.04)]">
                      {/* Grand Total Summary - ALWAYS VISIBLE */}
                      <div className="bg-[#f8fafc] p-4 rounded-xl border border-blue-50 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Grand Total</span>
                          <span className="text-3xl font-black text-[#2b59c3]">₱{calculateTotal().toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                           <Badge variant="outline" className="text-[9px] font-bold text-blue-500 border-blue-100 bg-blue-50/10">
                             {cart.reduce((sum, item) => sum + item.quantity, 0)} ITEMS
                           </Badge>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-500 pl-1">Payment Method</label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                              <SelectTrigger className="bg-gray-50 border-gray-100 h-11 text-xs font-bold text-gray-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-600 pl-1">Amount Received</label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={amountReceived}
                              onChange={(e) => setAmountReceived(e.target.value)}
                              className="bg-gray-50 border-gray-100 h-11 text-sm font-bold text-gray-700"
                            />
                          </div>
                        </div>

                        {paymentMethod === 'cash' && amountReceived && (
                           <div className="flex justify-between items-center px-1 bg-green-50/50 p-2 rounded-lg border border-green-100/50">
                             <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Change Due</span>
                             <span className="text-xl font-black text-green-700">₱{calculateChange().toFixed(2)}</span>
                           </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={clearCart}
                          className="flex-1 h-11 border-gray-200 text-gray-500 font-bold text-xs"
                        >
                          Clear All
                        </Button>
                        <Button 
                          onClick={handleCheckout}
                          disabled={paymentMethod === 'cash' && (!amountReceived || calculateChange() < 0)}
                          className="flex-1 h-11 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs gap-2 rounded-lg shadow-lg shadow-blue-100"
                        >
                          <CreditCard className="size-4" />
                          Complete Sale
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ErrorBoundary>
          </div>
        </div>

        {/* Transaction Summary Dialog - Desktop Details Style */}
        <Dialog open={!!completedTransaction} onOpenChange={(open) => !open && setCompletedTransaction(null)}>
          <DialogContent className="max-w-sm font-mono overflow-hidden flex flex-col items-center p-0 gap-0 border-none shadow-2xl bg-white">
            {/* Header Top Edge Decor */}
            <div className="w-full h-1 bg-gray-200" style={{ backgroundImage: 'linear-gradient(90deg, #f3f4f6 50%, transparent 50%)', backgroundSize: '10px 100%' }}></div>

            <div className="w-full p-8 flex flex-col">
              {/* Pharmacy Branding */}
              <div className="text-center mb-6">
                <h2 className="text-lg font-black tracking-tight text-gray-900 leading-tight uppercase">
                  Zoe Pharmacy & General Merchandise
                </h2>
                <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold leading-tight max-w-[280px] mx-auto">
                  40 Mata Cor, Manlunas Sts., Vab Brgy, 183, Pasay City, Metro Manila
                </p>
              </div>

              {/* Transaction Header Info */}
              <div className="flex flex-col gap-1 mb-4 border-y border-dashed border-gray-300 py-3 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500 uppercase">TRANS ID:</span>
                  <span className="font-bold">{completedTransaction?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 uppercase">DATE:</span>
                  <span>{completedTransaction ? new Date(completedTransaction.date).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 uppercase">CASHIER:</span>
                  <span className="uppercase">{completedTransaction?.cashier}</span>
                </div>
              </div>

              {/* Items List - Scrollable */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-xs font-bold border-b border-dashed border-gray-200 pb-2">
                  <span className="uppercase">ITEM DESCRIPTION</span>
                  <span className="uppercase">PRICE</span>
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {completedTransaction?.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs items-start">
                        <span className="font-bold flex-1 pr-4">{item.productName}</span>
                        <span className="font-bold">₱{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {item.quantity} units x ₱{item.price.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Section */}
              <div className="border-t-2 border-dashed border-gray-900 pt-4 space-y-2">
                <div className="flex justify-between text-sm font-black">
                  <span className="uppercase tracking-wider">TOTAL AMOUNT</span>
                  <span className="text-base">₱{completedTransaction?.total.toFixed(2)}</span>
                </div>

                {completedTransaction?.paymentMethod === 'cash' && (
                  <div className="space-y-1 mt-3 pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-[11px] text-gray-600">
                      <span className="uppercase">CASH RECEIVED</span>
                      <span>₱{completedTransaction.amountReceived?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-blue-700 bg-blue-50/50 p-2 rounded -mx-2 mt-1">
                      <span className="uppercase tracking-tighter">CHANGE DUE</span>
                      <span>₱{completedTransaction.change?.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-8 text-center space-y-4">
                <div className="text-[10px] text-gray-400 space-y-1">
                  <p className="uppercase font-bold tracking-[0.2em] text-gray-600">Thank you for your trust!</p>
                  <p>--- NO REFUND WITHOUT TRANSACTION DETAILS ---</p>
                  <p className="italic">This is not an official transaction record.</p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    className="w-full border-gray-300 rounded-none h-12 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                    onClick={() => completedTransaction && generatePDF(completedTransaction)}
                  >
                    <FileText className="size-4" />
                    Download Receipt
                  </Button>
                  <Button
                    className="w-full bg-gray-900 hover:bg-black text-white rounded-none h-12 font-bold uppercase tracking-widest text-xs"
                    onClick={() => setCompletedTransaction(null)}
                  >
                    Start New Transaction
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer Bottom Edge Decor */}
            <div className="w-full h-2 bg-gray-200" style={{ backgroundImage: 'linear-gradient(45deg, transparent 33.333%, #fff 33.333%, #fff 66.666%, transparent 66.666%), linear-gradient(-45deg, transparent 33.333%, #fff 33.333%, #fff 66.666%, transparent 66.666%)', backgroundSize: '12px 24px' }}></div>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary >
  );
}

