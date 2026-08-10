import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Book, Search, Eye, FileText, CheckCircle, Clock, Plus, Trash2, Upload, X } from 'lucide-react';

interface NoteItem {
  id: string;
  title: string;
  category: string;
  description: string;
  readTime: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  lastUpdated: string;
  pdfUrl?: string;
  content: string[];
}

export const StudyMaterial: React.FC = () => {
  const [materials, setMaterials] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  
  // Admin Upload State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State for Admin Upload
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('System Security');
  const [description, setDescription] = useState('');
  const [readTime, setReadTime] = useState('15 min read');
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [bulletPoints, setBulletPoints] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  useEffect(() => {
    // Check if logged in user is admin
    try {
      const userStr = localStorage.getItem('user');
      const roleStr = localStorage.getItem('role');
      if (roleStr === 'admin') {
        setIsAdmin(true);
      } else if (userStr) {
        const u = JSON.parse(userStr);
        if (u.role?.toLowerCase() === 'admin') {
          setIsAdmin(true);
        }
      }
    } catch {
      // Non-critical check fallback
    }

    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/study-materials');
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch (err) {
      console.error('Error loading study materials:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Please provide a title and description.');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('read_time', readTime);
      formData.append('difficulty', difficulty);

      const bulletsArray = bulletPoints
        .split('\n')
        .map(b => b.trim())
        .filter(Boolean);
      formData.append('content_bullets', JSON.stringify(bulletsArray));

      if (pdfFile) {
        formData.append('file', pdfFile);
      }

      const res = await fetch('/api/v1/study-materials/admin/upload', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || 'Failed to upload study material.');
        return;
      }

      setShowUploadModal(false);
      // Reset form
      setTitle('');
      setDescription('');
      setBulletPoints('');
      setPdfFile(null);
      await fetchMaterials();
    } catch (err) {
      console.error('Upload error:', err);
      alert('An error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('Are you sure you want to delete this study material?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/study-materials/admin/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        await fetchMaterials();
      } else {
        alert('Failed to delete study material.');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const categories = ['All', ...Array.from(new Set(materials.map(item => item.category)))];

  const filteredMaterials = materials.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Book className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Study Materials & Domain Notes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Access curated reference notes, cybersecurity playbooks, and OT/ICS domain documentation.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            Upload Study Material
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-8 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search notes, playbooks, keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        /* Material Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredMaterials.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Card Badge Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                    {item.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      item.difficulty === 'Advanced'
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'
                        : item.difficulty === 'Intermediate'
                        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {item.difficulty}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteMaterial(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title="Delete Material"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <h3 className="text-base font-bold text-slate-950 dark:text-white mb-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed mb-4">
                  {item.description}
                </p>
              </div>

              {/* Bottom Info & Action buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                <div className="flex items-center gap-4 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {item.readTime}
                  </span>
                  <span>• Updated {item.lastUpdated}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveNote(item)}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Notes
                  </button>
                  {item.pdfUrl ? (
                    <Link
                      to={`/study-material/view/${item.id}`}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-all inline-flex items-center"
                      title={`View ${item.title} PDF`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <button
                      onClick={() => alert(`PDF version is currently unavailable for ${item.title}.`)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-350 dark:text-slate-700 cursor-not-allowed"
                      title="PDF version unavailable"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredMaterials.length === 0 && (
            <div className="col-span-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <Book className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No study materials found</h3>
              <p className="text-xs text-slate-400 mt-1">Try refining your keyword search or filtering other domains.</p>
            </div>
          )}
        </div>
      )}

      {/* Reader Modal */}
      {activeNote && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4">
              <div>
                <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                  {activeNote.category}
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{activeNote.title}</h2>
              </div>
              <button
                onClick={() => setActiveNote(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs text-slate-500 dark:text-slate-400 italic">
                {activeNote.description}
              </div>
              
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Key Study Bulletins & Commands</h4>
                {activeNote.content.map((point, index) => (
                  <div key={index} className="flex gap-3 items-start text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
              <span className="text-xs text-slate-400">Estimated read time: {activeNote.readTime}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveNote(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-all"
                >
                  Close Reader
                </button>
                {activeNote.pdfUrl ? (
                  <Link
                    to={`/study-material/view/${activeNote.id}`}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    View Secure PDF
                  </Link>
                ) : (
                  <button
                    onClick={() => alert(`PDF version is currently unavailable for ${activeNote.title}.`)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-500 text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                    disabled
                  >
                    <Eye className="w-4 h-4" />
                    PDF Unavailable
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Upload New Study Material
              </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminUpload} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reverse Engineering & Malware Analysis Guide"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="System Security">System Security</option>
                    <option value="Network Security">Network Security</option>
                    <option value="Web Security">Web Security</option>
                    <option value="Cryptography">Cryptography</option>
                    <option value="Industrial Systems">Industrial Systems</option>
                    <option value="Cloud Security">Cloud Security</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Difficulty *</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide a short summary of key concepts covered in this study guide..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Key Bulletins & Commands (One per line)
                </label>
                <textarea
                  rows={4}
                  placeholder="GDB Debugging: Inspecting memory registers using x/32xw $esp&#10;Ghidra Decompiler: Analyzing assembly functions and cross-references"
                  value={bulletPoints}
                  onChange={(e) => setBulletPoints(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">PDF File (Optional)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 dark:file:bg-blue-950 dark:file:text-blue-400"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {uploading ? 'Uploading...' : 'Save & Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
