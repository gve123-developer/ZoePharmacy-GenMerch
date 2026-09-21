import { useState, useEffect } from 'react';
import { User, Product } from '@/app/App';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, Package, ChevronLeft, ChevronRight, Layers, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ArrowDownAZ, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { cn } from '@/app/components/ui/utils';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { logAuditAction } from '@/app/utils/auditUtils';
import { OwnerPasscodeModal } from '@/app/components/OwnerPasscodeModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/app/components/ui/alert-dialog';

interface InventoryManagementProps {
  currentUser: User;
  products: Product[];
  onProductsChange: (products: Product[]) => void;
}

const categories = ['Pharmaceutical', 'Non-pharmaceutical'];

export function InventoryManagement({ currentUser, products, onProductsChange }: InventoryManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStockStatus, setFilterStockStatus] = useState('all');
  const [sortName, setSortName] = useState<'none' | 'a-z' | 'z-a'>('none');
  const [sortStock, setSortStock] = useState<'none' | 'low-high' | 'high-low'>('none');
  const [primarySort, setPrimarySort] = useState<'name' | 'stock' | 'none'>('none');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [productToAuthEdit, setProductToAuthEdit] = useState<Product | null>(null);
  const [productToAuthDelete, setProductToAuthDelete] = useState<Product | null>(null);

  const handleAddProduct = async () => {
    if (!formData.name || !formData.sku || !formData.category || !formData.price || !formData.cost || !formData.quantity || !formData.reorderLevel) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/products.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Name': currentUser.name
        },
        body: JSON.stringify({
          ...formData,
          newStockQuantity: formData.newStockQuantity || 0,
          newStockExpiry: formData.newStockExpiry || null
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Product added successfully');
        logAuditAction(
          currentUser.name,
          'Inventory Add',
          `Added new product: ${formData.name} [SKU: ${formData.sku}] | Initial Qty: ${formData.quantity} | New Stock: ${formData.newStockQuantity || 0}`
        );
        setIsAddDialogOpen(false);
        setFormData({});
        const updatedProducts = await fetch('/api/products.php').then(res => res.json());
        onProductsChange(updatedProducts);
      } else {
        toast.error('Failed to add product: ' + data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error connecting to API');
    }
  };

  const handleEditProduct = async () => {
    if (!editingProduct) return;

    try {
      const response = await fetch(`/api/products.php?id=${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Name': currentUser.name
        },
        body: JSON.stringify({ ...editingProduct, ...formData })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Product updated successfully');
        logAuditAction(
          currentUser.name,
          'Inventory Update',
          `Updated product: ${formData.name} [SKU: ${formData.sku}] | Base Qty: ${formData.quantity} | New Stock: ${formData.newStockQuantity || 0}`
        );
        setIsEditDialogOpen(false);
        setEditingProduct(null);
        setFormData({});
        const updatedProducts = await fetch('/api/products.php').then(res => res.json());
        onProductsChange(updatedProducts);
      } else {
        toast.error('Failed to update product: ' + data.message);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error connecting to API');
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/products.php?id=${productToDelete.id}`, {
        method: 'DELETE',
        headers: { 'X-User-Name': currentUser.name }
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`"${productToDelete.name}" deleted successfully`);
        logAuditAction(
          currentUser.name,
          'Inventory Delete',
          `Deleted product: ${productToDelete.name} [SKU: ${productToDelete.sku}]`
        );
        const updatedProducts = await fetch('/api/products.php').then(res => res.json());
        onProductsChange(updatedProducts);
      } else {
        toast.error('Failed to delete: ' + data.message);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error connecting to API');
    } finally {
      setIsDeleting(false);
      setProductToDelete(null);
    }
  };

  const checkStockStatus = (p: Product) => {
    const total = Number(p.quantity) + Number(p.newStockQuantity || 0);
    if (total === 0) return 'out';
    if (total <= Number(p.reorderLevel)) return 'low';
    return 'in';
  };

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
      const matchesStock = filterStockStatus === 'all' || checkStockStatus(product) === filterStockStatus;
      return matchesSearch && matchesCategory && matchesStock;
    })
    .sort((a, b) => {
      const stockA = Number(a.quantity) + Number(a.newStockQuantity || 0);
      const stockB = Number(b.quantity) + Number(b.newStockQuantity || 0);

      // If Stock sorting was prioritized
      if (primarySort === 'stock' && sortStock !== 'none') {
        const stockDiff = sortStock === 'low-high' ? stockA - stockB : stockB - stockA;
        if (stockDiff !== 0) return stockDiff;
        if (sortName === 'a-z') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        if (sortName === 'z-a') return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
        return 0;
      }

      // If Name sorting was prioritized
      if (primarySort === 'name' && sortName !== 'none') {
        const nameDiff = sortName === 'a-z'
          ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
        if (nameDiff !== 0) return nameDiff;
        if (sortStock === 'low-high') return stockA - stockB;
        if (sortStock === 'high-low') return stockB - stockA;
        return 0;
      }

      // If only one of the sorts is active
      if (sortStock !== 'none') {
        const stockDiff = sortStock === 'low-high' ? stockA - stockB : stockB - stockA;
        if (stockDiff !== 0) return stockDiff;
      }

      if (sortName !== 'none') {
        return sortName === 'a-z'
          ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      }

      return 0;
    });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredProducts.length]);

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
    setIsEditDialogOpen(true);
  };

  const getStockStatus = (product: Product) => {
    const total = Number(product.quantity) + Number(product.newStockQuantity || 0);
    if (total === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (total <= product.reorderLevel) return { label: 'Low Stock', color: 'bg-orange-100 text-orange-800' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-800' };
  };

  return (
    <ErrorBoundary fallbackTitle="Inventory Management Module Error">
      <div className="space-y-6">
        {/* Delete Confirmation Dialog */}
        <Dialog open={!!productToDelete} onOpenChange={(open) => { if (!open && !isDeleting) setProductToDelete(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="size-5" />
                Delete Product
              </DialogTitle>
              <DialogDescription className="pt-2">
                Are you sure you want to delete <span className="font-bold text-gray-900">&ldquo;{productToDelete?.name}&rdquo;</span>?
                <br />
                <span className="text-red-500 text-xs mt-1 block">This action cannot be undone. Product will be removed and archived in deleted products records.</span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={() => setProductToDelete(null)} disabled={isDeleting}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Inventory Summary Cards */}
        <ErrorBoundary fallbackTitle="Inventory Summary Error">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white border-2 border-blue-100 shadow-sm transition-all hover:scale-[1.01]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-blue-900 uppercase tracking-wider">Total Products</CardTitle>
                <Package className="size-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-blue-700">{products.length}</div>
                <p className="text-xs font-semibold text-blue-600 mt-1 uppercase tracking-wider">Unique items</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 border-green-100 shadow-sm transition-all hover:scale-[1.01]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-green-900 uppercase tracking-wider">Total Units</CardTitle>
                <Layers className="size-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-green-700">
                  {products.reduce((sum, p) => sum + (Number(p.quantity) + Number(p.newStockQuantity || 0)), 0)}
                </div>
                <p className="text-xs font-semibold text-green-600 mt-1 uppercase tracking-wider">Aggregate Stock Count</p>
              </CardContent>
            </Card>
          </div>
        </ErrorBoundary>

        {/* Header */}
        <ErrorBoundary fallbackTitle="Inventory Header Error">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
              <p className="text-sm text-gray-500 mt-1">Manage your products and stock levels</p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Product</DialogTitle>
                  <DialogDescription>Enter the details of the new product</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name *</Label>
                    <Input id="name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input id="sku" value={formData.sku || ''} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category || ''} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input id="quantity" type="number" value={formData.quantity || ''} onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Selling Price (₱) *</Label>
                    <Input id="price" type="number" step="0.01" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Cost Price (₱) *</Label>
                    <Input id="cost" type="number" step="0.01" value={formData.cost || ''} onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reorderLevel">Reorder Level *</Label>
                    <Input id="reorderLevel" type="number" value={formData.reorderLevel || ''} onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input id="expiryDate" type="date" value={formData.expiryDate || ''} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} />
                  </div>
                  <div className="col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-3 my-2">
                    <h4 className="text-xs font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                      <Plus className="size-3" /> New Stock (Rotation Support)
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="newBatchQuantity" className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">New Stock Qty</Label>
                        <Input id="newBatchQuantity" type="number" placeholder="Optional" value={formData.newStockQuantity || ''} onChange={(e) => setFormData({ ...formData, newStockQuantity: Number(e.target.value) })} className="bg-white border-blue-200" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newBatchExpiry" className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">New Stock Expiry</Label>
                        <Input id="newBatchExpiry" type="date" value={formData.newStockExpiry || ''} onChange={(e) => setFormData({ ...formData, newStockExpiry: e.target.value })} className="bg-white border-blue-200" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setFormData({}); }}>Cancel</Button>
                  <Button onClick={handleAddProduct}>Add Product</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </ErrorBoundary>

        <ErrorBoundary fallbackTitle="Inventory Table Error">
          <Card>
            {/* INLINE COMPACT DROPDOWN FILTERS (Matching user's requested segmented bar style) */}
            <CardContent className="p-3.5 border-b border-gray-100 bg-gray-50/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* SEGMENTED DROPDOWNS BAR */}
                  <div className="inline-flex flex-wrap items-center rounded-lg border border-gray-200 bg-white shadow-2xs divide-x divide-gray-200 overflow-hidden">
                    {/* Category Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "h-9 px-3.5 text-xs font-semibold flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 transition-colors focus:outline-none select-none",
                            filterCategory !== 'all' && "bg-green-50/90 text-green-900 font-bold hover:bg-green-100/80"
                          )}
                        >
                          <Package className={cn("size-3.5 shrink-0", filterCategory !== 'all' ? "text-green-600" : "text-gray-400")} />
                          <span>
                            {filterCategory === 'all' ? 'Category' : `Category: ${filterCategory}`}
                          </span>
                          {filterCategory === 'all' && (
                            <span className="text-[10px] text-gray-400 font-normal">({products.length})</span>
                          )}
                          <ChevronDown className={cn("size-3.5 shrink-0 opacity-60 ml-0.5", filterCategory !== 'all' && "text-green-700 opacity-100")} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 p-1 bg-white border border-gray-200 shadow-lg rounded-lg z-50">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase text-gray-400 tracking-wider px-2 py-1.5">
                          Filter by Category
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup value={filterCategory} onValueChange={(val) => { setFilterCategory(val); setCurrentPage(1); }}>
                          <DropdownMenuRadioItem value="all" className="text-xs cursor-pointer py-2 font-medium">
                            All Categories ({products.length})
                          </DropdownMenuRadioItem>
                          {categories.map((cat) => {
                            const count = products.filter((p) => p.category === cat).length;
                            return (
                              <DropdownMenuRadioItem key={cat} value={cat} className="text-xs cursor-pointer py-2 font-medium">
                                {cat} ({count})
                              </DropdownMenuRadioItem>
                            );
                          })}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Stock Status Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "h-9 px-3.5 text-xs font-semibold flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 transition-colors focus:outline-none select-none",
                            filterStockStatus !== 'all' && "bg-green-50/90 text-green-900 font-bold hover:bg-green-100/80"
                          )}
                        >
                          <Layers className={cn("size-3.5 shrink-0", filterStockStatus !== 'all' ? "text-green-600" : "text-gray-400")} />
                          <span>
                            {filterStockStatus === 'all'
                              ? 'Stock Status'
                              : `Stock: ${filterStockStatus === 'in' ? 'In Stock' : filterStockStatus === 'low' ? 'Low Stock' : 'Out of Stock'}`}
                          </span>
                          <ChevronDown className={cn("size-3.5 shrink-0 opacity-60 ml-0.5", filterStockStatus !== 'all' && "text-green-700 opacity-100")} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52 p-1 bg-white border border-gray-200 shadow-lg rounded-lg z-50">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase text-gray-400 tracking-wider px-2 py-1.5">
                          Filter by Stock Status
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup value={filterStockStatus} onValueChange={(val) => { setFilterStockStatus(val); setCurrentPage(1); }}>
                          <DropdownMenuRadioItem value="all" className="text-xs cursor-pointer py-2 font-medium">
                            All Stock Levels
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="in" className="text-xs cursor-pointer py-2 font-medium">
                            In Stock
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="low" className="text-xs cursor-pointer py-2 font-medium">
                            Low Stock
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="out" className="text-xs cursor-pointer py-2 font-medium">
                            Out of Stock
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Alphabetical Order Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "h-9 px-3.5 text-xs font-semibold flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 transition-colors focus:outline-none select-none",
                            sortName !== 'none' && "bg-green-50/90 text-green-900 font-bold hover:bg-green-100/80"
                          )}
                        >
                          <ArrowDownAZ className={cn("size-3.5 shrink-0", sortName !== 'none' ? "text-green-600" : "text-gray-400")} />
                          <span>
                            {sortName === 'none' ? 'Alphabetical' : `Sort: ${sortName === 'a-z' ? 'A → Z' : 'Z → A'}`}
                          </span>
                          <ChevronDown className={cn("size-3.5 shrink-0 opacity-60 ml-0.5", sortName !== 'none' && "text-green-700 opacity-100")} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52 p-1 bg-white border border-gray-200 shadow-lg rounded-lg z-50">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase text-gray-400 tracking-wider px-2 py-1.5">
                          Alphabetical Sorting
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={sortName}
                          onValueChange={(val: any) => {
                            setSortName(val);
                            setPrimarySort(val === 'none' ? (sortStock !== 'none' ? 'stock' : 'none') : 'name');
                            setCurrentPage(1);
                          }}
                        >
                          <DropdownMenuRadioItem value="none" className="text-xs cursor-pointer py-2 font-medium">
                            Default (Original Order)
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="a-z" className="text-xs cursor-pointer py-2 font-medium">
                            A → Z (Alphabetical)
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="z-a" className="text-xs cursor-pointer py-2 font-medium">
                            Z → A (Reverse Alphabetical)
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Stock Level Order Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "h-9 px-3.5 text-xs font-semibold flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 transition-colors focus:outline-none select-none",
                            sortStock !== 'none' && "bg-green-50/90 text-green-900 font-bold hover:bg-green-100/80"
                          )}
                        >
                          <ArrowUpDown className={cn("size-3.5 shrink-0", sortStock !== 'none' ? "text-green-600" : "text-gray-400")} />
                          <span>
                            {sortStock === 'none'
                              ? 'Stock Level Order'
                              : `Stock: ${sortStock === 'low-high' ? 'Lowest → Highest' : 'Highest → Lowest'}`}
                          </span>
                          <ChevronDown className={cn("size-3.5 shrink-0 opacity-60 ml-0.5", sortStock !== 'none' && "text-green-700 opacity-100")} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 p-1 bg-white border border-gray-200 shadow-lg rounded-lg z-50">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase text-gray-400 tracking-wider px-2 py-1.5">
                          Stock Quantity Sorting
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={sortStock}
                          onValueChange={(val: any) => {
                            setSortStock(val);
                            setPrimarySort(val === 'none' ? (sortName !== 'none' ? 'name' : 'none') : 'stock');
                            setCurrentPage(1);
                          }}
                        >
                          <DropdownMenuRadioItem value="none" className="text-xs cursor-pointer py-2 font-medium">
                            Default (Original Order)
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="low-high" className="text-xs cursor-pointer py-2 font-medium">
                            Lowest → Highest Stock
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="high-low" className="text-xs cursor-pointer py-2 font-medium">
                            Highest → Lowest Stock
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Reset button if any filter/sort is active */}
                  {(filterCategory !== 'all' || filterStockStatus !== 'all' || sortName !== 'none' || sortStock !== 'none') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterCategory('all');
                        setFilterStockStatus('all');
                        setSortName('none');
                        setSortStock('none');
                        setPrimarySort('none');
                        setCurrentPage(1);
                      }}
                      className="h-9 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold gap-1.5"
                    >
                      <RotateCcw className="size-3.5" />
                      Reset Filters
                    </Button>
                  )}
                </div>
              </div>

              {/* Active Filter Indicators */}
              {(filterCategory !== 'all' || filterStockStatus !== 'all' || sortName !== 'none' || sortStock !== 'none' || searchQuery !== '') && (
                <div className="flex items-center gap-1.5 pt-3 mt-3 border-t border-gray-200/60 text-xs text-gray-500 flex-wrap">
                  <span className="font-semibold text-gray-400 text-[11px] uppercase tracking-wider">Active:</span>
                  {filterCategory !== 'all' && (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 font-semibold">
                      Category: {filterCategory}
                    </Badge>
                  )}
                  {filterStockStatus !== 'all' && (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 font-semibold">
                      Stock: {filterStockStatus === 'in' ? 'In Stock' : filterStockStatus === 'low' ? 'Low Stock' : 'Out of Stock'}
                    </Badge>
                  )}
                  {sortName !== 'none' && (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 font-semibold">
                      Alphabetical: {sortName === 'a-z' ? 'A → Z' : 'Z → A'}
                    </Badge>
                  )}
                  {sortStock !== 'none' && (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 font-semibold">
                      Stock Order: {sortStock === 'low-high' ? 'Lowest → Highest' : 'Highest → Lowest'}
                    </Badge>
                  )}
                  {searchQuery && (
                    <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-700 border-gray-300 font-semibold">
                      Search: "{searchQuery}"
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>

            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Package className="size-5 text-gray-700" />
                Products ({filteredProducts.length})
              </CardTitle>
              <div className="max-w-xs relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="h-10 pl-10 bg-white border-gray-200"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-200">
                      <TableHead
                        onClick={() => {
                          const next = sortName === 'a-z' ? 'z-a' : sortName === 'z-a' ? 'none' : 'a-z';
                          setSortName(next);
                          setPrimarySort(next === 'none' ? (sortStock !== 'none' ? 'stock' : 'none') : 'name');
                          setCurrentPage(1);
                        }}
                        className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100/80 transition-colors select-none"
                        title="Click to sort by Name (A-Z / Z-A)"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Product Details</span>
                          {sortName === 'a-z' && <span className="text-green-600 font-bold text-[10px] flex items-center gap-0.5"><ArrowUp className="size-3" /> A-Z</span>}
                          {sortName === 'z-a' && <span className="text-green-600 font-bold text-[10px] flex items-center gap-0.5"><ArrowDown className="size-3" /> Z-A</span>}
                          {sortName === 'none' && <ArrowUpDown className="size-3 text-gray-400 opacity-60" />}
                        </div>
                      </TableHead>
                      <TableHead
                        onClick={() => {
                          const next = sortStock === 'low-high' ? 'high-low' : sortStock === 'high-low' ? 'none' : 'low-high';
                          setSortStock(next);
                          setPrimarySort(next === 'none' ? (sortName !== 'none' ? 'name' : 'none') : 'stock');
                          setCurrentPage(1);
                        }}
                        className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200 text-center cursor-pointer hover:bg-gray-100/80 transition-colors select-none"
                        title="Click to sort by Stock Quantity (Lowest-Highest / Highest-Lowest)"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Old Stock</span>
                          {sortStock === 'low-high' && <span className="text-green-600 font-bold text-[10px] flex items-center gap-0.5"><ArrowUp className="size-3" /> Low</span>}
                          {sortStock === 'high-low' && <span className="text-green-600 font-bold text-[10px] flex items-center gap-0.5"><ArrowDown className="size-3" /> High</span>}
                          {sortStock === 'none' && <ArrowUpDown className="size-3 text-gray-400 opacity-60" />}
                        </div>
                      </TableHead>
                      <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200 text-center">New Stock</TableHead>
                      <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200">Price/Cost</TableHead>
                      <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200">Status</TableHead>
                      <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-200">
                    {paginatedProducts.map((product) => {
                      const status = getStockStatus(product);
                      return (
                        <TableRow key={product.id} className="hover:bg-gray-50/50 transition-colors">
                          <TableCell className="px-6 py-4 border-r border-gray-200">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{product.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter bg-gray-100 px-1 rounded">{product.sku}</span>
                                <span className="text-[10px] text-blue-500 font-bold uppercase">{product.category}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-4 border-r border-gray-200 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <span className={`text-md font-black ${Number(product.quantity) === 0 ? 'text-red-600' : 'text-gray-900'}`}>{Number(product.quantity) === 0 ? '-' : product.quantity}</span>
                              <span className="text-[9px] text-gray-400 font-bold uppercase">EXP: {product.expiryDate || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-4 border-r border-gray-200 text-center">
                            {product.newStockQuantity && product.newStockQuantity > 0 ? (
                              <div className="flex flex-col items-center justify-center">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-black h-4 px-1.5 mb-1">NEW STOCK</Badge>
                                <span className="text-sm font-black text-blue-800">{product.newStockQuantity}</span>
                                <span className="text-[9px] text-gray-400 font-bold uppercase">EXP: {product.newStockExpiry || 'N/A'}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-bold">-</span>
                            )}
                          </TableCell>
                          <TableCell className="px-6 py-4 border-r border-gray-200 text-sm">
                            <div className="flex flex-col">
                              <span className="font-bold text-green-700">₱{product.price.toFixed(2)}</span>
                              <span className="text-[10px] text-gray-400 font-bold italic">Cost: ₱{product.cost.toFixed(2)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-4 border-r border-gray-200">
                            <Badge className={`${status.color} border-none font-black text-[10px] uppercase tracking-widest leading-none`}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <div className="flex gap-2">
                              {Number(product.quantity) === 0 && (product.newStockQuantity ?? 0) > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 bg-blue-600 text-white hover:bg-blue-700 text-[10px] font-black uppercase"
                                  onClick={async () => {
                                    // Promotion logic: Move new batch to old quantity
                                    const updatedProduct = {
                                      ...product,
                                      quantity: product.newStockQuantity,
                                      expiryDate: product.newStockExpiry,
                                      newStockQuantity: 0,
                                      newStockExpiry: null
                                    };
                                    try {
                                      const res = await fetch(`/api/products.php?id=${product.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json', 'X-User-Name': currentUser.name },
                                        body: JSON.stringify(updatedProduct)
                                      });
                                      if (res.ok) {
                                        toast.success('Batch rotated successfully');
                                        logAuditAction(
                                          currentUser.name,
                                          'Batch Rotation',
                                          `Promoted ${product.newStockQuantity} units for ${product.name} [SKU: ${product.sku}]`
                                        );
                                        const updatedProducts = await fetch('/api/products.php').then(r => r.json());
                                        onProductsChange(updatedProducts);
                                      }
                                    } catch (e) { toast.error('Rotation failed'); }
                                  }}
                                >
                                  Rot. Stock
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => setProductToAuthEdit(product)} className="h-8 w-8 p-0" title="Edit Product (Requires Owner Passcode)">
                                <Edit className="size-4 text-blue-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setProductToAuthDelete(product)} className="h-8 w-8 p-0" title="Delete Product (Requires Owner Passcode)">
                                <Trash2 className="size-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">No products found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl">
              <div className="text-sm text-gray-500 font-medium">
                Showing <span className="text-gray-900 font-bold">{filteredProducts.length === 0 ? 0 : startIndex + 1}</span> to <span className="text-gray-900 font-bold">{Math.min(startIndex + itemsPerPage, filteredProducts.length)}</span> of <span className="text-gray-900 font-bold">{filteredProducts.length}</span> products
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
          </Card>
        </ErrorBoundary>

        {/* Edit Dialog */}
        <ErrorBoundary fallbackTitle="Edit Dialog Error">
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Product</DialogTitle>
                <DialogDescription>Update product details</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Product Name</Label>
                  <Input id="edit-name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">SKU</Label>
                  <Input id="edit-sku" value={formData.sku || ''} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select value={formData.category || ''} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-quantity">Quantity</Label>
                  <Input id="edit-quantity" type="number" value={formData.quantity || ''} onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Selling Price (₱)</Label>
                  <Input id="edit-price" type="number" step="0.01" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cost">Cost Price (₱)</Label>
                  <Input id="edit-cost" type="number" step="0.01" value={formData.cost || ''} onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-reorderLevel">Reorder Level</Label>
                  <Input id="edit-reorderLevel" type="number" value={formData.reorderLevel || ''} onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-expiryDate">Expiry Date</Label>
                  <Input id="edit-expiryDate" type="date" value={formData.expiryDate || ''} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} />
                </div>
                <div className="col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-3 my-2">
                  <h4 className="text-xs font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                    <Plus className="size-3" /> New Stock (Rotation Support)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-nb-qty" className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">New Stock Qty</Label>
                      <Input id="edit-nb-qty" type="number" placeholder="Optional" value={formData.newStockQuantity || ''} onChange={(e) => setFormData({ ...formData, newStockQuantity: Number(e.target.value) })} className="bg-white border-blue-200" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-nb-exp" className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">New Stock Expiry</Label>
                      <Input id="edit-nb-exp" type="date" value={formData.newStockExpiry || ''} onChange={(e) => setFormData({ ...formData, newStockExpiry: e.target.value })} className="bg-white border-blue-200" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input id="edit-description" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setFormData({}); setEditingProduct(null); }}>Cancel</Button>
                <Button onClick={() => setShowSaveConfirm(true)}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ErrorBoundary>

        {/* Confirm Save Changes Dialog */}
        <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
          <AlertDialogContent className="max-w-md bg-white border-0 shadow-2xl p-6 rounded-2xl">
            <AlertDialogHeader className="flex flex-col items-center text-center">
              <div className="size-14 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
                <Package className="size-7 text-indigo-600" />
              </div>
              <AlertDialogTitle className="text-xl font-black text-gray-900">
                Save Product Changes?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-600 mt-2">
                Are you sure you want to save changes for{' '}
                <span className="font-bold text-gray-900">"{formData.name || editingProduct?.name}"</span>?
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 my-3 text-xs text-gray-700 space-y-1.5">
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Product Name:</span>
                <span className="font-bold text-gray-900">{formData.name || editingProduct?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Selling Price:</span>
                <span className="font-bold text-gray-900">₱{Number(formData.price ?? editingProduct?.price ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Base Quantity:</span>
                <span className="font-bold text-gray-900">{formData.quantity ?? editingProduct?.quantity} units</span>
              </div>
            </div>

            <AlertDialogFooter className="flex gap-2 sm:gap-3 mt-4">
              <AlertDialogCancel
                onClick={() => setShowSaveConfirm(false)}
                className="flex-1 font-bold rounded-xl"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowSaveConfirm(false);
                  handleEditProduct();
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
              >
                Yes, Save Changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Owner Passcode Authorization for Edit */}
        <OwnerPasscodeModal
          isOpen={!!productToAuthEdit}
          actionTitle={`Edit Product: ${productToAuthEdit?.name || ''}`}
          actionDescription="Owner authorization required to modify inventory product details or pricing."
          onSuccess={() => {
            if (productToAuthEdit) {
              const p = productToAuthEdit;
              setProductToAuthEdit(null);
              openEditDialog(p);
            }
          }}
          onClose={() => setProductToAuthEdit(null)}
        />

        {/* Owner Passcode Authorization for Delete */}
        <OwnerPasscodeModal
          isOpen={!!productToAuthDelete}
          actionTitle={`Delete Product: ${productToAuthDelete?.name || ''}`}
          actionDescription="Owner authorization required before deleting a product from inventory."
          onSuccess={() => {
            if (productToAuthDelete) {
              const p = productToAuthDelete;
              setProductToAuthDelete(null);
              setProductToDelete(p);
            }
          }}
          onClose={() => setProductToAuthDelete(null)}
        />
      </div>
    </ErrorBoundary>
  );
}
