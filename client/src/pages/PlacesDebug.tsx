import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function PlacesDebug() {
  const [docId, setDocId] = useState<string>(() => new URLSearchParams(location.search).get('docId') || '');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();

  const runPreview = async () => {
    if (!docId) {
      toast({ title: 'DocId obrigatório', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const API_URL = 'https://us-central1-eventu-1b077.cloudfunctions.net/api';
      const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken();
      const resp = await fetch(`${API_URL}/places/${encodeURIComponent(docId)}/popular-times/preview`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
      setResult(data);
    } catch (e: any) {
      toast({ title: 'Erro no preview', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <h1 className="text-xl font-bold mb-4">Debug de Place - Preview</h1>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Input
          placeholder="DocId do lugar"
          className="h-9 w-96 bg-slate-700 border-slate-600 text-white"
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
        />
        <Button onClick={runPreview} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
          {loading ? 'Buscando...' : 'Executar Preview'}
        </Button>
      </div>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded border border-slate-700 p-3 overflow-auto">
            <h2 className="font-semibold mb-2">SerpApi</h2>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result.serpapi, null, 2)}</pre>
          </div>
          <div className="bg-slate-800 rounded border border-slate-700 p-3 overflow-auto">
            <h2 className="font-semibold mb-2">Outscraper (detalhes)</h2>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result.outscraper, null, 2)}</pre>
          </div>
          <div className="bg-slate-800 rounded border border-slate-700 p-3 overflow-auto md:col-span-2">
            <h2 className="font-semibold mb-2">Outscraper Tasks (raw + normalizado)</h2>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result.outscraper_tasks, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}


