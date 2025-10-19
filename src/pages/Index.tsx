import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Auth } from '@/components/Auth';
import { MindMapCanvas } from '@/components/MindMapCanvas';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mindMapId, setMindMapId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        loadOrCreateMindMap(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadOrCreateMindMap(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadOrCreateMindMap = async (userId: string) => {
    // Try to load existing mind map
    const { data: existingMaps } = await supabase
      .from('mind_maps')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingMaps && existingMaps.length > 0) {
      setMindMapId(existingMaps[0].id);
    } else {
      // Create a new mind map
      const { data: newMap, error } = await supabase
        .from('mind_maps')
        .insert({
          user_id: userId,
          title: 'My First Mind Map',
        })
        .select()
        .single();

      if (error) {
        toast.error('Failed to create mind map');
        return;
      }

      setMindMapId(newMap.id);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMindMapId(null);
    toast.success('Signed out successfully');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (!mindMapId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Setting up your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      <Button
        onClick={handleSignOut}
        variant="secondary"
        size="sm"
        className="absolute top-4 right-4 z-10 gap-2"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>
      <MindMapCanvas mindMapId={mindMapId} />
    </div>
  );
};

export default Index;
