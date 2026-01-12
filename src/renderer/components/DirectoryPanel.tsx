import { useEffect, useMemo, useRef, useState } from 'react';
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

function getParentPath(path: string): string {
  if (!path) {
    return '';
  }
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

export default function DirectoryPanel({ agentDir }: DirectoryPanelProps) {
  const [directoryInfo, setDirectoryInfo] = useState<DirectoryTreeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<DirectoryTreeNode | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(400);

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

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setTreeHeight(Math.max(200, Math.floor(entry.contentRect.height)));
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const treeData = useMemo(() => {
    return directoryInfo?.tree.children ?? [];
  }, [directoryInfo]);

  const selectedDirPath =
    selectedNode?.type === 'dir' ? selectedNode.path : getParentPath(selectedNode?.path ?? '');

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
    <div className="flex h-full flex-col border-l border-neutral-200 bg-neutral-50">
      <div className="border-b border-neutral-200 px-4 py-3">
        <div className="text-xs font-semibold text-neutral-600">Agent Directory</div>
        <div className="mt-1 text-xs break-all text-neutral-500">{agentDir}</div>
        {directoryInfo && (
          <div className="mt-2 text-[11px] text-neutral-500">
            Files {directoryInfo.summary.totalFiles} - Directories {directoryInfo.summary.totalDirs}
            {directoryInfo.truncated && ' - Truncated'}
          </div>
        )}
      </div>

      <div className="relative z-10 border-b border-neutral-200 px-4 py-2 text-[11px] text-neutral-500">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900">
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
            <a
              href={`/agent/download?path=${encodeURIComponent(selectedNode.path)}`}
              className="rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
            >
              Download
            </a>
          )}
          <button
            type="button"
            onClick={refresh}
            className="rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
          >
            Refresh
          </button>
          {isUploading && <span className="text-[11px] text-neutral-400">Uploading...</span>}
        </div>
      </div>

      <div ref={containerRef} className="relative z-0 flex-1 overflow-hidden px-2 py-2">
        {error && <div className="px-2 text-xs text-red-500">{error}</div>}
        {!error && !directoryInfo && (
          <div className="px-2 text-xs text-neutral-400">Loading...</div>
        )}
        {directoryInfo && (
          <Tree
            data={treeData}
            openByDefault={false}
            disableDrag
            disableDrop
            rowHeight={24}
            indent={16}
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
              return (
                <div
                  style={style}
                  className={`flex items-center gap-2 rounded px-2 text-[11px] ${
                    node.isSelected ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (node.isInternal) {
                        node.toggle();
                      }
                    }}
                    className="text-neutral-400"
                  >
                    {node.isInternal ?
                      node.isOpen ?
                        '-'
                      : '+'
                    : ' '}
                  </button>
                  <span className="text-neutral-400">{data.type === 'dir' ? '[D]' : '[F]'}</span>
                  <span className="truncate">{data.name}</span>
                </div>
              );
            }}
          </Tree>
        )}
      </div>
    </div>
  );
}
