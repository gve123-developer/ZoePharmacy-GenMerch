import { useState, ChangeEvent } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Search, Calendar, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { User, Product, LossEntry } from '@/app/App';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';

interface ExpiryManagementProps {
    currentUser: User;
    products: Product[];
    onProductsChange: (products: Product[]) => void;
}

import { speak } from '@/app/utils/voiceUtils';

export function ExpiryManagement({ currentUser, products, onProductsChange }: ExpiryManagementProps) {

    const handleDispose = async (product: Product) => {
        const loss = product.quantity * (product.cost || 0);
        const productName = product.name;

        try {
            // Update the quantity in the backend database
            const response = await fetch(`/api/products.php?id=${product.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Name': currentUser.name
                },
                body: JSON.stringify({ ...product, quantity: 0 })
            });

            if (!response.ok) {
                throw new Error('Failed to update backend');
            }

            // Record the loss in database instead of localStorage
            const lossResponse = await fetch('/api/inventory_loss.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Name': currentUser.name
                },
                body: JSON.stringify({
                    productId: product.id,
                    quantity: product.quantity,
                    cost: product.cost || 0,
                    reason: 'Expired'
                })
            });

            if (!lossResponse.ok) {
                console.warn('Failed to record loss to database, but quantity was updated.');
            }

            // Voice alert in English as requested
            speak([
                `Loss Alert. We lost ${loss.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })} due to expired ${productName}.`
            ]);

            const updatedProducts = products.map(p =>
                p.id === product.id ? { ...p, quantity: 0 } : p
            );

            onProductsChange(updatedProducts);
        } catch (error) {
            console.error("Error disposing product:", error);
            alert("Failed to dispose product. Please ensure the backend is running.");
        }
    };
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<'all' | 'safe' | 'soon' | 'expired'>('all');
    const [expiryTimeFilter, setExpiryTimeFilter] = useState<'all' | 'week' | 'month' | 'sixMonths' | 'year'>('all');
    const itemsPerPage = 10;

    const getDaysRemaining = (expiryDate: string | undefined): number | undefined => {
        if (!expiryDate) return undefined;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cleanDate = expiryDate.includes('T') ? expiryDate : expiryDate + 'T00:00:00';
        const expiry = new Date(cleanDate);
        expiry.setHours(0, 0, 0, 0);
        const diffTime = expiry.getTime() - today.getTime();
        return Math.round(diffTime / (1000 * 60 * 60 * 24));
    };

    const getActiveExpiryDate = (p: Product): string | undefined => {
        if (Number(p.quantity) <= 0 && Number(p.newStockQuantity) > 0 && p.newStockExpiry) {
            return p.newStockExpiry;
        }
        return p.expiryDate;
    };

    const filteredProducts = products
        .filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.sku.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            const activeExpiry = getActiveExpiryDate(p);

            // Time filtering logic
            if (expiryTimeFilter !== 'all') {
                if (!activeExpiry) return false;
                const expiryDate = new Date(activeExpiry);
                const now = new Date();

                if (expiryTimeFilter === 'week') {
                    const lastWeek = new Date(now);
                    lastWeek.setDate(now.getDate() - 7);
                    lastWeek.setHours(0, 0, 0, 0);

                    if (expiryDate < lastWeek || expiryDate > now) {
                        return false;
                    }
                } else if (expiryTimeFilter === 'month') {
                    if (expiryDate.getMonth() !== now.getMonth() || expiryDate.getFullYear() !== now.getFullYear()) {
                        return false;
                    }
                } else if (expiryTimeFilter === 'sixMonths') {
                    const todayStart = new Date(now);
                    todayStart.setHours(0, 0, 0, 0);
                    
                    const sixMonthsFromNow = new Date(now);
                    sixMonthsFromNow.setMonth(now.getMonth() + 6);
                    sixMonthsFromNow.setHours(23, 59, 59, 999);

                    if (expiryDate < todayStart || expiryDate > sixMonthsFromNow) {
                        return false;
                    }
                } else if (expiryTimeFilter === 'year') {
                    if (expiryDate.getFullYear() !== now.getFullYear()) {
                        return false;
                    }
                }
            }

            if (statusFilter === 'all') return true;

            const days = getDaysRemaining(activeExpiry);
            if (days === undefined) return false;

            if (statusFilter === 'expired') return days < 0;
            if (statusFilter === 'soon') return days >= 0 && days <= 30;
            if (statusFilter === 'safe') return days > 30;

            return true;
        })
        .sort((a, b) => {
            const activeA = getActiveExpiryDate(a);
            const activeB = getActiveExpiryDate(b);
            if (!activeA) return 1;
            if (!activeB) return -1;
            return new Date(activeA).getTime() - new Date(activeB).getTime();
        });

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSearchChange = (val: string) => {
        setSearchTerm(val);
        setCurrentPage(1); // Reset to first page on search
    };

    const toggleStatusFilter = (filter: 'safe' | 'soon' | 'expired') => {
        setStatusFilter(prev => prev === filter ? 'all' : filter);
        setCurrentPage(1);
    };

    const getExpiryStatus = (product: Product) => {
        const totalStock = Number(product.quantity) + Number(product.newStockQuantity || 0);
        if (totalStock <= 0) {
            return { label: 'OUT OF STOCK', color: 'bg-gray-50 text-gray-400 border border-gray-100 text-[8px] px-1.5 py-0.5 font-bold uppercase tracking-tighter opacity-60', icon: <X className="size-2 mr-1" /> };
        }

        const activeExpiry = getActiveExpiryDate(product);

        if (!activeExpiry) return { label: 'No Date', color: 'bg-gray-100 text-gray-800', icon: null };

        const diffDays = getDaysRemaining(activeExpiry);
        if (diffDays === undefined) return { label: 'No Date', color: 'bg-gray-100 text-gray-800', icon: null };

        if (diffDays < 0) return { label: 'Expired', color: 'bg-red-100 text-red-800', icon: <AlertTriangle className="size-3 mr-1" />, days: diffDays };
        if (diffDays <= 30) return { label: 'Expiring Soon', color: 'bg-orange-100 text-orange-800', icon: <AlertTriangle className="size-3 mr-1" />, days: diffDays };
        if (diffDays <= 90) return { label: 'Caution', color: 'bg-yellow-100 text-yellow-800', icon: <AlertTriangle className="size-3 mr-1" />, days: diffDays };
        return { label: 'Safe', color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="size-3 mr-1" />, days: diffDays };
    };

    return (
        <ErrorBoundary fallbackTitle="Expiry Management Module Error">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Expiry Tracker</h2>
                        <p className="text-sm text-gray-500 mt-1">Track and monitor product expiration dates</p>
                    </div>
                </div>

                {/* Summary Cards */}
                <ErrorBoundary fallbackTitle="Expiry Summary Error">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card
                            onClick={() => toggleStatusFilter('safe')}
                            className={`cursor-pointer transition-all hover:scale-[1.02] ${statusFilter === 'safe'
                                ? 'bg-green-100 border-green-500 shadow-md ring-2 ring-green-200'
                                : 'bg-green-50 border-green-200 shadow shadow-green-100'
                                } border-2`}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold text-green-900 flex items-center justify-between">
                                    Safe Products
                                    <CheckCircle2 className={`size-5 ${statusFilter === 'safe' ? 'text-green-700' : 'text-green-600'}`} />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-black ${statusFilter === 'safe' ? 'text-green-800' : 'text-green-700'}`}>
                                    {products.filter(p => {
                                        const days = getDaysRemaining(getActiveExpiryDate(p));
                                        return days !== undefined && days > 30;
                                    }).length}
                                </div>
                                <p className="text-xs font-semibold text-green-600 mt-1 uppercase tracking-wider">Valid for more than 30 days</p>
                            </CardContent>
                        </Card>

                        <Card
                            onClick={() => toggleStatusFilter('soon')}
                            className={`cursor-pointer transition-all hover:scale-[1.02] ${statusFilter === 'soon'
                                ? 'bg-orange-100 border-orange-500 shadow-md ring-2 ring-orange-200'
                                : 'bg-orange-50 border-orange-200 shadow shadow-orange-100'
                                } border-2`}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold text-orange-900 flex items-center justify-between">
                                    Expiring Soon
                                    <AlertTriangle className={`size-5 ${statusFilter === 'soon' ? 'text-orange-700' : 'text-orange-600'}`} />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-black ${statusFilter === 'soon' ? 'text-orange-800' : 'text-orange-700'}`}>
                                    {products.filter(p => {
                                        const days = getDaysRemaining(getActiveExpiryDate(p));
                                        return days !== undefined && days >= 0 && days <= 30;
                                    }).length}
                                </div>
                                <p className="text-xs font-semibold text-orange-600 mt-1 uppercase tracking-wider">Within next 30 days</p>
                            </CardContent>
                        </Card>

                        <Card
                            onClick={() => toggleStatusFilter('expired')}
                            className={`cursor-pointer transition-all hover:scale-[1.02] ${statusFilter === 'expired'
                                ? 'bg-red-100 border-red-500 shadow-md ring-2 ring-red-200'
                                : 'bg-red-50 border-red-200 shadow shadow-red-100'
                                } border-2`}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold text-red-900 flex items-center justify-between">
                                    Expired Products
                                    <AlertTriangle className={`size-5 ${statusFilter === 'expired' ? 'text-red-700' : 'text-red-600'}`} />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-black ${statusFilter === 'expired' ? 'text-red-800' : 'text-red-700'}`}>
                                    {products.filter(p => {
                                        const days = getDaysRemaining(getActiveExpiryDate(p));
                                        return days !== undefined && days < 0;
                                    }).length}
                                </div>
                                <p className="text-xs font-semibold text-red-600 mt-1 uppercase tracking-wider">Require immediate action</p>
                            </CardContent>
                        </Card>
                    </div>
                </ErrorBoundary>

                <ErrorBoundary fallbackTitle="Product Expiry List Error">
                    <Card>
                        <CardHeader className="border-b bg-white p-4">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <Calendar className="size-5 text-blue-600" />
                                    Product Expiry List
                                </CardTitle>

                                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                                    <div className="relative w-full md:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                                        <Input
                                            placeholder="Search..."
                                            className="pl-9 h-9 text-sm bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                                            value={searchTerm}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                        {statusFilter !== 'all' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setStatusFilter('all')}
                                                className="h-9 text-red-500 hover:text-red-700 hover:bg-red-50 px-3"
                                            >
                                                <X className="size-4 mr-1" /> Clear
                                            </Button>
                                        )}

                                        <Select value={expiryTimeFilter} onValueChange={(val: any) => { setExpiryTimeFilter(val); setCurrentPage(1); }}>
                                            <SelectTrigger className="w-full md:w-[140px] h-9">
                                                <SelectValue placeholder="Period" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Time</SelectItem>
                                                <SelectItem value="week">Weekly (Last 7 Days)</SelectItem>
                                                <SelectItem value="month">This Month</SelectItem>
                                                <SelectItem value="sixMonths">Next 6 Months</SelectItem>
                                                <SelectItem value="year">This Year</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto w-full">
                                <Table className="min-w-[800px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[300px] border px-4 py-2 bg-gray-100 font-bold text-gray-700">Product Name</TableHead>
                                            <TableHead className="border px-4 py-2 bg-gray-100 font-bold text-gray-700">SKU</TableHead>
                                            <TableHead className="border px-4 py-2 bg-gray-100 font-bold text-gray-700">Category</TableHead>
                                            <TableHead className="border px-4 py-2 bg-gray-100 font-bold text-gray-700">Current Stock</TableHead>
                                            <TableHead className="border px-4 py-2 bg-gray-100 font-bold text-gray-700">Expiry Date</TableHead>
                                            <TableHead className="border px-4 py-2 bg-gray-100 font-bold text-gray-700">Status</TableHead>
                                            <TableHead className="text-right border px-4 py-2 bg-gray-100 font-bold text-gray-700">Days Remaining</TableHead>
                                            <TableHead className="text-center border px-4 py-2 bg-gray-100 font-bold text-gray-700">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedProducts.length > 0 ? (
                                            paginatedProducts.map((product) => {
                                                const status = getExpiryStatus(product);
                                                return (
                                                    <TableRow key={product.id} className="hover:bg-gray-50 transition-colors even:bg-gray-50/50">
                                                        <TableCell className="font-medium text-gray-900 whitespace-nowrap min-w-[150px] border px-4 py-2">{product.name}</TableCell>
                                                        <TableCell className="text-gray-500 font-mono text-xs whitespace-nowrap border px-4 py-2">{product.sku}</TableCell>
                                                        <TableCell className="whitespace-nowrap border px-4 py-2">
                                                            <Badge variant="outline" className="font-normal">
                                                                {product.category}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="border px-4 py-2">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex justify-between items-center gap-4">
                                                                    <span className="text-[10px] font-bold text-gray-400">OLD:</span>
                                                                    <span className={`text-xs font-black ${product.quantity === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{product.quantity}</span>
                                                                </div>
                                                                {(product.newStockQuantity ?? 0) > 0 && (
                                                                    <div className="flex justify-between items-center gap-4 border-t border-gray-100 pt-1">
                                                                        <span className="text-[10px] font-bold text-blue-400">NEW:</span>
                                                                        <span className="text-xs font-black text-blue-700">{product.newStockQuantity}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-gray-700 whitespace-nowrap border px-4 py-2">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="font-bold text-gray-900 text-[13px]">
                                                                    {getActiveExpiryDate(product) ? new Date(getActiveExpiryDate(product)!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                                                                </div>
                                                                {(product.newStockQuantity ?? 0) > 0 && (
                                                                    <span className="text-[10px] font-bold text-blue-600 border-t border-gray-100 pt-1">
                                                                        {product.newStockExpiry ? new Date(product.newStockExpiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap border px-4 py-2">
                                                            <Badge className={`${status.color} border-none shadow-sm flex w-fit items-center`}>
                                                                {status.icon}
                                                                {status.label}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className={`text-center font-bold whitespace-nowrap border px-4 py-2 ${status.label === 'Expired' ? 'text-red-600' :
                                                            status.label === 'Expiring Soon' ? 'text-orange-600' :
                                                                'text-gray-900'
                                                            }`}>
                                                            {status.days !== undefined ? (
                                                                status.days < 0 ? `${Math.abs(status.days)} ago` : status.days
                                                            ) : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center whitespace-nowrap border px-4 py-2">
                                                            {(status.label === 'Expired' || status.label === 'Expiring Soon') && product.quantity > 0 && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={() => handleDispose(product)}
                                                                    className="bg-red-600 hover:bg-red-700 font-bold text-xs uppercase tracking-tighter"
                                                                >
                                                                    <X className="size-3 mr-1" /> Dispose
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-32 text-center text-gray-500 whitespace-normal border px-4 py-2">
                                                    No products found with the current filters.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                        {totalPages > 1 && (
                            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl">
                                <div className="text-sm text-gray-500 font-medium">
                                    Showing <span className="text-gray-900 font-bold">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="text-gray-900 font-bold">{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</span> of <span className="text-gray-900 font-bold">{filteredProducts.length}</span> products
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
                                        disabled={currentPage >= totalPages}
                                        className="bg-white border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                                    >
                                        Next
                                        <ChevronRight className="size-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </ErrorBoundary>
            </div>
        </ErrorBoundary>
    );
}
