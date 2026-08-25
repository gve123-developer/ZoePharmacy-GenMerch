import { useState, useEffect } from 'react';
import { User } from '@/app/App';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Users, Eye, EyeOff } from 'lucide-react';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { logAuditAction } from '@/app/utils/auditUtils';

interface UserManagementProps {
  currentUser: User;
}

export function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users.php');
      if (!res.ok) throw new Error('Failed to load users from DB');
      const data = await res.json();
      setUsers(data);
      // Synchronize with local storage for LoginPage caching
      localStorage.setItem('users', JSON.stringify(data));
    } catch (err: any) {
      console.error(err);
      // Fallback to localStorage if server fails
      const storedUsers = localStorage.getItem('users');
      if (storedUsers) {
        setUsers(JSON.parse(storedUsers));
      }
    }
  };

  const saveUsers = (updatedUsers: User[]) => {
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
  };

  const handleAddUser = () => {
    if (!formData.username || !formData.name || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password && formData.password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Check if username already exists locally
    if (users.some(u => u.username === formData.username)) {
      toast.error('Username already exists');
      return;
    }

    // Check if email already exists locally
    if (users.some(u => u.email === formData.email)) {
      toast.error('Email already exists');
      return;
    }

    // Send add user request to backend
    fetch('/api/users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        username: formData.username,
        name: formData.name,
        email: formData.email,
        password: formData.password || 'password'
      })
    })
    .then(async res => {
      const result = await res.json();
      if (res.ok && result.success) {
        const updatedUsers = [...users, result.user];
        saveUsers(updatedUsers);
        setIsAddDialogOpen(false);
        setFormData({});
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
        logAuditAction(currentUser.name, 'User Added', `Added new user: ${result.user.username}`);
        toast.success(result.message || 'User added successfully');
      } else {
        toast.error(result.message || 'Failed to add user to database');
      }
    })
    .catch(err => {
      toast.error('Failed to connect to backend database');
    });
  };

  const handleEditUser = () => {
    if (!editingUser) return;

    if (!formData.username || !formData.name || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check if new username conflicts with another user
    if (formData.username && formData.username !== editingUser.username) {
      if (users.some(u => u.username === formData.username && u.id !== editingUser.id)) {
        toast.error('Username already exists');
        return;
      }
    }

    // Check if new email conflicts with another user
    if (formData.email && formData.email !== editingUser.email) {
      if (users.some(u => u.email === formData.email && u.id !== editingUser.id)) {
        toast.error('Email already exists');
        return;
      }
    }

    // Send edit request to backend
    fetch('/api/users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        id: editingUser.id,
        username: formData.username,
        name: formData.name,
        email: formData.email,
        password: formData.password || ''
      })
    })
    .then(async res => {
      const result = await res.json();
      if (res.ok && result.success) {
        const newLocalUser = { ...editingUser, ...formData };
        delete newLocalUser.password; // Don't cache plaintext password in memory
        
        const updatedUsers = users.map(u =>
          u.id === editingUser.id ? newLocalUser : u
        );
        saveUsers(updatedUsers);
        setIsEditDialogOpen(false);
        setEditingUser(null);
        setFormData({});
        logAuditAction(currentUser.name, 'User Updated', `Updated details for user: ${newLocalUser.username}`);
        toast.success('User updated successfully');
      } else {
        toast.error(result.message || 'Failed to update user');
      }
    })
    .catch(err => {
      toast.error('Failed to connect to backend database');
    });
  };

  const handleDeleteUser = (id: string) => {
    // Don't allow deleting current user
    if (id === currentUser.id) {
      toast.error('Cannot delete currently logged in user');
      return;
    }

    // Don't allow deleting the last admin
    if (users.length <= 1) {
      toast.error('Cannot delete the last admin account');
      return;
    }

    const user = users.find(u => u.id === id);
    if (user) {
      setUserToDelete(user);
      setIsDeleteDialogOpen(true);
    }
  };

  const confirmDeleteUser = () => {
    if (!userToDelete) return;
    
    fetch('/api/users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        id: userToDelete.id
      })
    })
    .then(async res => {
      const result = await res.json();
      if (res.ok && result.success) {
        const updatedUsers = users.filter(u => u.id !== userToDelete.id);
        saveUsers(updatedUsers);
        logAuditAction(currentUser.name, 'User Deleted', `Deleted user: ${userToDelete.username}`);
        toast.success('User deleted successfully');
        setIsDeleteDialogOpen(false);
        setUserToDelete(null);
      } else {
        toast.error(result.message || 'Failed to delete user');
      }
    })
    .catch(err => {
      toast.error('Failed to connect to backend database');
    });
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData(user);
    setIsEditDialogOpen(true);
  };

  return (
    <ErrorBoundary fallbackTitle="User Management Module Error">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage system users and their roles</p>
          </div>
          <ErrorBoundary fallbackTitle="Add User Dialog Error">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>Create a new user account</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={formData.username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Enter username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password || ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-800">
                      <strong>Note:</strong> Passwords are case-sensitive.
                      Default is "password" if left empty.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setFormData({}); setConfirmPassword(''); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddUser}>Add User</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </ErrorBoundary>
        </div>

        {/* Users Table */}
        <ErrorBoundary fallbackTitle="Users Table Error">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="size-4" />
                System Users ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Username</TableHead>
                      <TableHead className="text-xs">Full Name</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Last Login</TableHead>
                      <TableHead className="text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium text-xs">
                        {user.username}
                        {user.id === currentUser.id && (
                          <Badge className="ml-2 bg-green-100 text-green-800 text-xs">Current User</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{user.name}</TableCell>
                      <TableCell className="text-xs">{user.email || 'N/A'}</TableCell>
                      <TableCell className="text-gray-500 text-xs">
                        {user.lastLogin || 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === currentUser.id}
                          >
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          </Card>
        </ErrorBoundary>

        {/* Edit Dialog */}
        <ErrorBoundary fallbackTitle="Edit User Dialog Error">
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update user information</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-username">Username *</Label>
                  <Input
                    id="edit-username"
                    value={formData.username || ''}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Full Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
                  <div className="relative">
                    <Input
                      id="edit-password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setFormData({}); setEditingUser(null); }}>
                  Cancel
                </Button>
                <Button onClick={handleEditUser}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ErrorBoundary>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <Trash2 className="size-5" />
                Delete User
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the user <strong>{userToDelete?.username}</strong>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" className="bg-red-600 hover:bg-red-700" onClick={confirmDeleteUser}>
                Delete User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
