import { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { X, Trash2, Save, Link as LinkIcon, Image, FileText, Plus, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';

interface Link {
  id: string;
  title: string;
  url: string;
}

interface MediaItem {
  id: string;
  url: string;
  type: 'upload' | 'generated' | 'link';
  name: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: number;
}

interface NodePanelProps {
  node: Node | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: { 
    label?: string; 
    content?: string;
    links?: Link[];
    images?: MediaItem[];
    documents?: Document[];
  }) => void;
  onDelete: (nodeId: string) => void;
}

export const NodePanel = ({ node, isOpen, onClose, onUpdate, onDelete }: NodePanelProps) => {
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [links, setLinks] = useState<Link[]>([]);
  const [images, setImages] = useState<MediaItem[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  
  // New link form
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  useEffect(() => {
    if (node) {
      setLabel(String(node.data.label || ''));
      setContent(String(node.data.content || ''));
      setLinks((node.data.links as Link[]) || []);
      setImages((node.data.images as MediaItem[]) || []);
      setDocuments((node.data.documents as Document[]) || []);
    }
  }, [node]);

  const handleSave = () => {
    if (node) {
      onUpdate(node.id, { label, content, links, images, documents });
    }
  };

  const handleAddLink = () => {
    if (newLinkTitle.trim() && newLinkUrl.trim()) {
      const newLink: Link = {
        id: crypto.randomUUID(),
        title: newLinkTitle,
        url: newLinkUrl,
      };
      setLinks([...links, newLink]);
      setNewLinkTitle('');
      setNewLinkUrl('');
    }
  };

  const handleRemoveLink = (id: string) => {
    setLinks(links.filter(link => link.id !== id));
  };

  const handleAddImageLink = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      const newImage: MediaItem = {
        id: crypto.randomUUID(),
        url,
        type: 'link',
        name: 'Linked Image',
      };
      setImages([...images, newImage]);
    }
  };

  const handleRemoveImage = (id: string) => {
    setImages(images.filter(img => img.id !== id));
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  const handleDelete = () => {
    if (node && confirm('Are you sure you want to delete this node?')) {
      onDelete(node.id);
    }
  };

  if (!isOpen || !node) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-card border-l border-border shadow-2xl z-50 animate-slide-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Node Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {/* Title at top */}
            <div className="space-y-2 mb-6">
              <Label htmlFor="label">Title</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Node title"
              />
            </div>

            {/* Tabbed Sections */}
            <Tabs defaultValue="notes" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="notes" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Notes
                </TabsTrigger>
                <TabsTrigger value="links" className="gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Links
                </TabsTrigger>
                <TabsTrigger value="media" className="gap-2">
                  <Image className="w-4 h-4" />
                  Media
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Files
                </TabsTrigger>
              </TabsList>

              {/* Notes Tab */}
              <TabsContent value="notes" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="content">Notes</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Add your notes and ideas here..."
                    className="min-h-[400px] resize-none"
                  />
                </div>
              </TabsContent>

              {/* Links Tab */}
              <TabsContent value="links" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Add Reference Link</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Link title"
                      value={newLinkTitle}
                      onChange={(e) => setNewLinkTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                    />
                    <Input
                      placeholder="https://..."
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                    />
                    <Button onClick={handleAddLink} size="icon">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {links.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No links yet. Add reference links above.
                    </p>
                  ) : (
                    links.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{link.title}</p>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                          >
                            {link.url}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLink(link.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Media Tab */}
              <TabsContent value="media" className="space-y-4 mt-4">
                <div className="flex gap-2">
                  <Button onClick={handleAddImageLink} variant="outline" className="flex-1">
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Add Image Link
                  </Button>
                  <Button variant="outline" className="flex-1" disabled>
                    <Plus className="w-4 h-4 mr-2" />
                    Upload (Soon)
                  </Button>
                  <Button variant="outline" className="flex-1" disabled>
                    <Image className="w-4 h-4 mr-2" />
                    Generate (Soon)
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {images.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8 col-span-2">
                      No images yet. Add images using the buttons above.
                    </p>
                  ) : (
                    images.map((img) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.url}
                          alt={img.name}
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveImage(img.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {img.name}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-4 mt-4">
                <Button variant="outline" className="w-full" disabled>
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Document (Coming Soon)
                </Button>

                <div className="space-y-2">
                  {documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No documents yet. Upload documents to keep them organized.
                    </p>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => window.open(doc.url, '_blank')}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-8 h-8 text-primary" />
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.type.toUpperCase()}
                              {doc.size && ` • ${(doc.size / 1024).toFixed(1)}KB`}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveDocument(doc.id);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-6 border-t border-border flex gap-2">
          <Button onClick={handleSave} className="flex-1 gap-2">
            <Save className="w-4 h-4" />
            Save Changes
          </Button>
          <Button onClick={handleDelete} variant="destructive" size="icon">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
};
