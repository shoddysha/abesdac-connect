import { useState, useEffect } from 'react';
import { X, Book, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Documentation } from '@/services/help';

interface DocumentationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentation: Documentation | null;
  allDocs: Documentation[];
}

export function DocumentationDetailModal({
  isOpen,
  onClose,
  documentation,
  allDocs,
}: DocumentationDetailModalProps) {
  const [currentDoc, setCurrentDoc] = useState<Documentation | null>(documentation);

  useEffect(() => {
    setCurrentDoc(documentation);
  }, [documentation]);

  if (!currentDoc) return null;

  // Get docs in the same category for navigation
  const sameCategoryDocs = allDocs.filter(
    (doc) => doc.category === currentDoc.category
  );
  const currentIndex = sameCategoryDocs.findIndex((doc) => doc.id === currentDoc.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < sameCategoryDocs.length - 1;

  function handlePrevious() {
    if (hasPrevious) {
      setCurrentDoc(sameCategoryDocs[currentIndex - 1]);
    }
  }

  function handleNext() {
    if (hasNext) {
      setCurrentDoc(sameCategoryDocs[currentIndex + 1]);
    }
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="" size="xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 flex-shrink-0">
            <Book className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                {currentDoc.category}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{currentDoc.title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-slate max-w-none">
          <div className="text-slate-700 leading-relaxed whitespace-pre-line">
            {currentDoc.content}
          </div>
        </div>

        {/* Navigation */}
        {sameCategoryDocs.length > 1 && (
          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={!hasPrevious}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <span className="text-sm text-slate-500">
              {currentIndex + 1} of {sameCategoryDocs.length} in {currentDoc.category}
            </span>

            <Button
              variant="outline"
              onClick={handleNext}
              disabled={!hasNext}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
