import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Tree, type NodeApi } from 'react-arborist';

type DirectoryTreeNode = {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: DirectoryTreeNode[];
};

type DirectoryTreeResponse = {
  root: string;
  summary: {
    totalFiles: number;
    totalDirs: number;
  };
  tree: DirectoryTreeNode;
  truncated: boolean;
};

interface DirectoryPanelProps {
  agentDir: string;
}

type FilePreview = {
  name: string;
  content: string;
  size: number;
};

function getParentPath(path: string): string {
  if (!path) {
    return '';
  }
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

function getFileExtension(name: string): string {
  const parts = name.split('.');
  if (parts.length <= 1) {
    return '';
  }
  return parts.pop() ?? '';
}

export default function DirectoryPanel({ agentDir }: DirectoryPanelProps) {
  const [directoryInfo, setDirectoryInfo] = useState<DirectoryTreeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<DirectoryTreeNode | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(240);

  const refresh = () => {
    setError(null);
    fetch('/agent/dir')
      .then((response) => response.json())
      .then((data: DirectoryTreeResponse) => {
        setDirectoryInfo(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load directory info');
      });
  };

  useEffect(() => {
    refresh();
  }, [agentDir]);

  const updateTreeHeight = () => {
    const element = treeContainerRef.current;
    if (!element) {
      return;
    }
    const nextHeight = Math.max(180, Math.floor(element.getBoundingClientRect().height));
    setTreeHeight(nextHeight);
  };

  useLayoutEffect(() => {
    updateTreeHeight();
  }, [directoryInfo]);

  useEffect(() => {
    const element = treeContainerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateTreeHeight);
    });

    observer.observe(element);
    window.addEventListener('resize', updateTreeHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateTreeHeight);
    };
  }, []);

  const treeData = useMemo(() => {
    return directoryInfo?.tree.children ?? [];
  }, [directoryInfo]);

  const rootName = directoryInfo?.tree.name ?? 'Workspace';

  const selectedDirPath =
    selectedNode?.type === 'dir' ? selectedNode.path : getParentPath(selectedNode?.path ?? '');

  const handlePreview = async (node: DirectoryTreeNode) => {
    if (node.type !== 'file' || isPreviewLoading) {
      return;
    }

    setIsPreviewLoading(true);
    setPreview(null);
    setPreviewError(null);

    try {
      const response = await fetch(`/agent/file?path=${encodeURIComponent(node.path)}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'Failed to preview file.');
      }
      const payload = (await response.json()) as FilePreview;
      setPreview(payload);
    } catch (err) {
      setPreview(null);
      setPreviewError(err instanceof Error ? err.message : 'Failed to preview file.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file, file.name);
      });
      const query = selectedDirPath ? `?path=${encodeURIComponent(selectedDirPath)}` : '';
      const response = await fetch(`/agent/upload${query}`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-full flex-col border-l border-[var(--line)] bg-[var(--paper-contrast)]/70">
      <div className="border-b border-[var(--line)] px-4 py-4">
        <div className="text-[11px] font-semibold tracking-[0.2em] text-[var(--ink-muted)] uppercase">
          Agent Directory
        </div>
        <div className="mt-2 text-xs break-all text-[var(--ink)]">{agentDir}</div>
        {directoryInfo && (
          <div className="mt-2 text-[11px] text-[var(--ink-muted)]">
            Files {directoryInfo.summary.totalFiles} - Directories {directoryInfo.summary.totalDirs}
            {directoryInfo.truncated && ' - Truncated'}
          </div>
        )}
      </div>

      <div className="relative z-10 border-b border-[var(--line)] px-4 py-3 text-[11px] text-[var(--ink-muted)]">
        <div className="flex items-center gap-2">
          <label className="action-button cursor-pointer px-3 py-1 text-[11px] font-semibold">
            Upload
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(event) => handleUpload(event.target.files)}
              disabled={isUploading}
            />
          </label>
          {selectedNode?.type === 'file' && (
            <>
              <button
                type="button"
                onClick={() => {
                  void handlePreview(selectedNode);
                }}
                className="action-button px-3 py-1 text-[11px] font-semibold"
              >
                View
              </button>
              <a
                href={`/agent/download?path=${encodeURIComponent(selectedNode.path)}`}
                className="action-button px-3 py-1 text-[11px] font-semibold"
              >
                Download
              </a>
            </>
          )}
          <button
            type="button"
            onClick={refresh}
            className="action-button px-3 py-1 text-[11px] font-semibold"
          >
            Refresh
          </button>
          {isUploading && <span className="text-[11px] text-[var(--ink-muted)]">Uploading...</span>}
        </div>
      </div>

      <div className="relative z-0 flex-1 overflow-hidden px-3 py-3">
        {error && <div className="px-2 text-xs text-red-600">{error}</div>}
        {!error && !directoryInfo && (
          <div className="px-2 text-xs text-[var(--ink-muted)]">Loading...</div>
        )}
        {directoryInfo && (
          <div className="soft-panel flex h-full flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 text-[11px] font-semibold text-[var(--ink)]">
              <FolderOpen className="h-3.5 w-3.5 text-[var(--accent-cool)]" />
              <span className="truncate">{rootName}</span>
            </div>
            <div ref={treeContainerRef} className="min-h-0 flex-1 overflow-hidden">
              <Tree
                data={treeData}
                openByDefault
                disableDrag
                disableDrop
                rowHeight={28}
                indent={18}
                height={treeHeight}
                width="100%"
                onSelect={(nodes: NodeApi<DirectoryTreeNode>[]) => {
                  setSelectedNode(nodes[0]?.data ?? null);
                }}
                onActivate={(node) => {
                  if (node.isInternal) {
                    node.toggle();
                  } else {
                    setSelectedNode(node.data);
                  }
                }}
              >
                {({ node, style }) => {
                  const data = node.data as DirectoryTreeNode;
                  const isDir = data.type === 'dir';
                  const extension = !isDir ? getFileExtension(data.name) : '';
                  const Icon =
                    isDir ?
                      node.isOpen ?
                        FolderOpen
                      : Folder
                    : FileText;

                  return (
                    <div style={style} className="pr-2">
                      <div
                        className={`tree-item group ${node.isSelected ? 'selected' : ''}`}
                        onClick={(event) => {
                          node.handleClick(event);
                          setSelectedNode(node.data as DirectoryTreeNode);
                        }}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (node.isInternal) {
                              node.toggle();
                            }
                          }}
                          className="text-[var(--ink-muted)]"
                          aria-label={node.isInternal ? 'Toggle folder' : 'File'}
                        >
                          {node.isInternal ?
                            <ChevronRight
                              className={`h-3.5 w-3.5 transition-transform ${
                                node.isOpen ? 'rotate-90' : ''
                              }`}
                            />
                          : <span className="inline-block h-3.5 w-3.5" />}
                        </button>
                        <Icon
                          className={`h-3.5 w-3.5 ${
                            isDir ? 'text-[var(--accent-cool)]' : 'text-[var(--accent)]'
                          }`}
                        />
                        <span className="tree-item-label">{data.name}</span>
                        {extension && (
                          <span className="tree-item-meta">{extension.toUpperCase()}</span>
                        )}
                      </div>
                    </div>
                  );
                }}
              </Tree>
            </div>
          </div>
        )}
      </div>
      {(preview || previewError || isPreviewLoading) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
              <div>
                <div className="text-[13px] font-semibold text-[var(--ink)]">
                  {preview?.name ?? 'Preview'}
                </div>
                {preview && (
                  <div className="text-[11px] text-[var(--ink-muted)]">
                    {preview.size.toLocaleString()} bytes
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setPreviewError(null);
                }}
                className="action-button px-3 py-1 text-[11px] font-semibold"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto px-5 py-4">
              {isPreviewLoading && (
                <div className="text-[12px] text-[var(--ink-muted)]">Loading preview...</div>
              )}
              {previewError && <div className="text-[12px] text-red-600">{previewError}</div>}
              {preview && !isPreviewLoading && !previewError && (
                <pre className="text-[12px] leading-relaxed whitespace-pre-wrap text-[var(--ink)]">
                  {preview.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
