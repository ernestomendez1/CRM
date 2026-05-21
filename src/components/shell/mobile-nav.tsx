'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SidebarNav } from './sidebar-nav';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        }
      />
      <DialogContent className="left-0 right-auto top-0 translate-x-0 translate-y-0 h-full w-72 rounded-none p-0 sm:max-w-none">
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <div onClick={() => setOpen(false)}>
          <SidebarNav />
        </div>
      </DialogContent>
    </Dialog>
  );
}
