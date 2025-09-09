/*
 * Interactive Drag & Drop Builder for CourseMaker
 * 
 * Usage:
 * - Sandbox Mode: Visit without URL params for local testing
 * - Course Mode: Use ?courseId=123&slideId=456 for API integration
 * 
 * Features:
 * - Native HTML5 drag & drop with @dnd-kit for accessibility
 * - Real-time preview mode simulation
 * - Auto-save to localStorage + API integration
 * - Full validation and error handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { v4 as uuidv4 } from 'uuid';
import { DragDropExerciseV1, ItemPlacement } from '@/types/dragdrop';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Plus, 
  Settings, 
  Eye, 
  Save, 
  ArrowLeft, 
  GripVertical, 
  Edit2, 
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  RotateCcw
} from 'lucide-react';

// Default empty exercise
const createEmptyExercise = (): DragDropExerciseV1 => ({
  version: 1,
  instructions: '',
  settings: {
    shuffleItems: true,
    allowMultiplePerZone: true,
    snapToZone: true,
    scoring: 'per-item',
    showInstantFeedback: true,
    backgroundColor: '#ffffff',
  },
  zones: [],
  items: [],
});

// Sample data for quick testing
const createSampleExercise = (): DragDropExerciseV1 => ({
  version: 1,
  instructions: 'Drag each item to its correct category.',
  settings: {
    shuffleItems: true,
    allowMultiplePerZone: true,
    snapToZone: true,
    scoring: 'per-item',
    showInstantFeedback: true,
    backgroundColor: '#ffffff',
  },
  zones: [
    {
      id: uuidv4(),
      title: 'Fruits',
      description: 'Natural sweet foods',
      color: '#10B981',
    },
    {
      id: uuidv4(),
      title: 'Vegetables',
      description: 'Nutritious plant foods',
      color: '#F59E0B',
    },
  ],
  items: [
    {
      id: uuidv4(),
      text: 'Apple',
      correctZoneId: '',
      points: 1,
    },
    {
      id: uuidv4(),
      text: 'Carrot',
      correctZoneId: '',
      points: 1,
    },
    {
      id: uuidv4(),
      text: 'Banana',
      correctZoneId: '',
      points: 1,
    },
    {
      id: uuidv4(),
      text: 'Broccoli',
      correctZoneId: '',
      points: 1,
    },
  ],
});

// API helpers
const saveExercise = async (
  exercise: DragDropExerciseV1, 
  courseId?: string, 
  slideId?: string
): Promise<boolean> => {
  if (courseId && slideId) {
    try {
      const response = await fetch(`/api/courses/${courseId}/slides/${slideId}/drag-drop`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exercise),
      });
      
      if (!response.ok) throw new Error('API save failed');
      return true;
    } catch (error) {
      console.error('API save error:', error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save to server. Changes saved locally.",
      });
    }
  }
  
  // Fallback to localStorage
  localStorage.setItem('dragdrop-exercise', JSON.stringify(exercise));
  return false;
};

const loadExercise = async (courseId?: string, slideId?: string): Promise<DragDropExerciseV1> => {
  if (courseId && slideId) {
    try {
      const response = await fetch(`/api/courses/${courseId}/slides/${slideId}/drag-drop`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('API load error:', error);
    }
  }
  
  // Fallback to localStorage
  const saved = localStorage.getItem('dragdrop-exercise');
  return saved ? JSON.parse(saved) : createEmptyExercise();
};

// Draggable Item Component
const DraggableItem: React.FC<{
  item: DragDropExerciseV1['items'][0];
  isPreview?: boolean;
  isCorrect?: boolean;
  showFeedback?: boolean;
}> = ({ item, isPreview = false, isCorrect, showFeedback = false }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: isPreview && showFeedback,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        inline-flex items-center gap-2 rounded-xl px-4 py-3 shadow-sm border transition-all
        ${isDragging 
          ? 'opacity-50 rotate-2 scale-105 shadow-lg ring-2 ring-primary' 
          : 'hover:shadow-md cursor-grab active:cursor-grabbing'
        }
        ${showFeedback && isCorrect !== undefined
          ? isCorrect 
            ? 'bg-success/20 border-success text-success' 
            : 'bg-destructive/20 border-destructive text-destructive'
          : 'bg-card border-border text-card-foreground hover:border-primary/50'
        }
      `}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{item.text}</span>
      {item.points && item.points !== 1 && (
        <Badge variant="secondary" className="text-xs">
          {item.points}pt
        </Badge>
      )}
      {showFeedback && isCorrect !== undefined && (
        <div className="ml-2">
          {isCorrect ? (
            <CheckCircle className="h-4 w-4 text-success" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
        </div>
      )}
    </div>
  );
};

// Droppable Zone Component
const DroppableZone: React.FC<{
  zone: DragDropExerciseV1['zones'][0];
  items: DragDropExerciseV1['items'][0][];
  isPreview?: boolean;
  showFeedback?: boolean;
  correctPlacements?: Set<string>;
}> = ({ zone, items, isPreview = false, showFeedback = false, correctPlacements }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: zone.id,
  });

  return (
    <Card 
      ref={setNodeRef}
      className={`
        min-h-32 transition-all duration-200
        ${isOver 
          ? 'ring-2 ring-primary bg-primary/5 border-primary' 
          : 'hover:border-primary/30'
        }
      `}
      style={{ borderLeftColor: zone.color || undefined, borderLeftWidth: zone.color ? '4px' : undefined }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{zone.title}</CardTitle>
        {zone.description && (
          <p className="text-sm text-muted-foreground">{zone.description}</p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <DraggableItem 
              key={item.id} 
              item={item} 
              isPreview={isPreview}
              isCorrect={showFeedback ? correctPlacements?.has(item.id) : undefined}
              showFeedback={showFeedback}
            />
          ))}
          {items.length === 0 && (
            <div className="text-muted-foreground text-sm py-4 w-full text-center">
              {isOver ? 'Drop items here' : 'No items yet'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Main Builder Component
const DragDropBuilder: React.FC = () => {
  const [exercise, setExercise] = useState<DragDropExerciseV1>(createEmptyExercise());
  const [placements, setPlacements] = useState<ItemPlacement[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DragDropExerciseV1['zones'][0] | null>(null);
  const [editingItem, setEditingItem] = useState<DragDropExerciseV1['items'][0] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Get URL params
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get('courseId');
  const slideId = urlParams.get('slideId');
  const isSandbox = !courseId || !slideId;

  // Load exercise on mount
  useEffect(() => {
    loadExercise(courseId || undefined, slideId || undefined).then((loaded) => {
      setExercise(loaded);
      // Initialize placements with all items unassigned
      const initialPlacements = loaded.items.map(item => ({
        itemId: item.id,
        zoneId: null,
      }));
      setPlacements(initialPlacements);
    });
  }, [courseId, slideId]);

  // Auto-save to localStorage
  useEffect(() => {
    if (exercise.zones.length > 0 || exercise.items.length > 0) {
      localStorage.setItem('dragdrop-exercise', JSON.stringify(exercise));
    }
  }, [exercise]);

  // Get items for a specific zone
  const getZoneItems = useCallback((zoneId: string) => {
    const zoneItemIds = placements
      .filter(p => p.zoneId === zoneId)
      .map(p => p.itemId);
    return exercise.items.filter(item => zoneItemIds.includes(item.id));
  }, [placements, exercise.items]);

  // Get unassigned items
  const getUnassignedItems = useCallback(() => {
    const assignedItemIds = placements
      .filter(p => p.zoneId !== null)
      .map(p => p.itemId);
    return exercise.items.filter(item => !assignedItemIds.includes(item.id));
  }, [placements, exercise.items]);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const itemId = active.id as string;
    const newZoneId = over.id === 'unassigned' ? null : over.id as string;

    setPlacements(prev => 
      prev.map(p => 
        p.itemId === itemId 
          ? { ...p, zoneId: newZoneId }
          : p
      )
    );
  };

  // Calculate score for preview
  const calculateScore = useCallback(() => {
    const correct = new Set<string>();
    let totalPoints = 0;
    let earnedPoints = 0;

    exercise.items.forEach(item => {
      totalPoints += item.points || 1;
      const placement = placements.find(p => p.itemId === item.id);
      
      if (placement?.zoneId === item.correctZoneId || 
          item.altCorrectZoneIds?.includes(placement?.zoneId || '')) {
        correct.add(item.id);
        earnedPoints += item.points || 1;
      }
    });

    return { correct, totalPoints, earnedPoints };
  }, [exercise.items, placements]);

  // Validation
  const getValidationErrors = useCallback(() => {
    const errors: string[] = [];
    
    if (exercise.zones.length === 0) {
      errors.push('At least one zone is required');
    }
    
    if (exercise.items.length === 0) {
      errors.push('At least one item is required');
    }
    
    exercise.items.forEach(item => {
      if (!item.correctZoneId || !exercise.zones.find(z => z.id === item.correctZoneId)) {
        errors.push(`Item "${item.text}" has invalid correct zone`);
      }
    });
    
    const zoneTitles = exercise.zones.map(z => z.title.toLowerCase());
    if (new Set(zoneTitles).size !== zoneTitles.length) {
      errors.push('Zone titles must be unique');
    }
    
    return errors;
  }, [exercise]);

  // Save handler
  const handleSave = async () => {
    const errors = getValidationErrors();
    if (errors.length > 0) {
      toast({
        variant: "destructive",
        title: "Validation Failed",
        description: errors[0],
      });
      return;
    }

    setIsSaving(true);
    const success = await saveExercise(exercise, courseId || undefined, slideId || undefined);
    setIsSaving(false);

    toast({
      title: "Exercise Saved",
      description: success 
        ? "Successfully saved to course slide"
        : isSandbox 
          ? "Saved locally (Sandbox Mode)"
          : "Saved locally due to connection issue",
    });
  };

  // Load sample data
  const loadSampleData = () => {
    const sample = createSampleExercise();
    // Set correct zone IDs for sample items
    sample.items[0].correctZoneId = sample.zones[0].id; // Apple -> Fruits
    sample.items[1].correctZoneId = sample.zones[1].id; // Carrot -> Vegetables  
    sample.items[2].correctZoneId = sample.zones[0].id; // Banana -> Fruits
    sample.items[3].correctZoneId = sample.zones[1].id; // Broccoli -> Vegetables
    
    setExercise(sample);
    setPlacements(sample.items.map(item => ({ itemId: item.id, zoneId: null })));
    toast({
      title: "Sample Data Loaded",
      description: "Example exercise with fruits and vegetables",
    });
  };

  const score = isPreview && showResults ? calculateScore() : null;
  const validationErrors = getValidationErrors();
  const canSave = validationErrors.length === 0;

  // Preview Mode - Student Experience
  if (isPreview) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: exercise.settings.backgroundColor || '#ffffff' }}>
        {/* Course Player Header */}
        <header className="bg-gray-900 text-white">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <h1 className="text-lg font-medium">Preview: Drag & Drop Exercise</h1>
                  <p className="text-sm text-gray-300">Student Experience Preview</p>
                </div>
                <div className="text-sm text-gray-300">
                  <div>Slide 1 of 1</div>
                  <div>100% complete</div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-gray-800"
                onClick={() => {
                  setIsPreview(false);
                  setShowResults(false);
                }}
              >
                × Exit Preview
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-white shadow-lg">
              <CardContent className="p-8">
                <DndContext onDragEnd={handleDragEnd}>
                  {/* Instructions */}
                  {exercise.instructions && (
                    <div className="mb-6 text-center">
                      <p className="text-lg text-gray-700">{exercise.instructions}</p>
                    </div>
                  )}

                  {/* Zones */}
                  <div className="space-y-6 mb-8">
                    {exercise.zones.map((zone) => (
                      <DroppableZone
                        key={zone.id}
                        zone={zone}
                        items={getZoneItems(zone.id)}
                        isPreview={true}
                        showFeedback={showResults}
                        correctPlacements={score?.correct}
                      />
                    ))}
                  </div>

                  {/* Unassigned Items */}
                  {getUnassignedItems().length > 0 && (
                    <Card className="border-dashed border-2 border-gray-300">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-gray-600">Available Items</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div 
                          {...useDroppable({ id: 'unassigned' }).setNodeRef}
                          className="flex flex-wrap gap-3 min-h-16"
                        >
                          {getUnassignedItems().map((item) => (
                            <DraggableItem 
                              key={item.id} 
                              item={item}
                              isPreview={true}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Results */}
                  {score && showResults && (
                    <Card className="border-green-500 bg-green-50 mt-6">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <h3 className="text-lg font-semibold mb-2 text-green-800">Results</h3>
                          <p className="text-2xl font-bold text-green-600">
                            {score.earnedPoints} / {score.totalPoints} points
                          </p>
                          <p className="text-sm text-green-700">
                            {Math.round((score.earnedPoints / score.totalPoints) * 100)}% correct
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </DndContext>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-center gap-4">
              <Button variant="secondary" size="sm" disabled>
                ← Previous Slide
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white px-6"
                size="sm"
                onClick={() => setShowResults(!showResults)}
              >
                <Play className="h-4 w-4 mr-2" />
                {showResults ? 'Hide Results' : 'Check Answers'}
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" size="sm" disabled>
                Next Slide →
              </Button>
            </div>
            <div className="text-center mt-2">
              <p className="text-xs text-gray-400">Press SPACEBAR to play/pause</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Course
              </Button>
              <div>
                <h1 className="text-xl font-semibold">
                  Interactive Drag & Drop Builder
                  {isSandbox && <Badge variant="secondary" className="ml-2">Sandbox Mode</Badge>}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Create a drag-and-drop exercise for this slide
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="container mx-auto px-6 py-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Canvas */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Canvas</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsPreview(!isPreview);
                          setShowResults(false);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Student Preview
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Instructions */}
                  {exercise.instructions && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{exercise.instructions}</p>
                    </div>
                  )}

                  {/* Zones */}
                  <div className="space-y-4">
                    {exercise.zones.map((zone) => (
                      <DroppableZone
                        key={zone.id}
                        zone={zone}
                        items={getZoneItems(zone.id)}
                        isPreview={isPreview}
                        showFeedback={showResults}
                        correctPlacements={score?.correct}
                      />
                    ))}
                  </div>

                  {/* Unassigned Items */}
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Unassigned Items</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div 
                        {...useDroppable({ id: 'unassigned' }).setNodeRef}
                        className="flex flex-wrap gap-2 min-h-16"
                      >
                        {getUnassignedItems().map((item) => (
                          <DraggableItem 
                            key={item.id} 
                            item={item}
                            isPreview={isPreview}
                          />
                        ))}
                        {getUnassignedItems().length === 0 && (
                          <div className="text-muted-foreground text-sm py-4 w-full text-center">
                            All items are placed
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Preview Results */}
                  {score && showResults && (
                    <Card className="border-primary">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <h3 className="text-lg font-semibold mb-2">Results</h3>
                          <p className="text-2xl font-bold text-primary">
                            {score.earnedPoints} / {score.totalPoints} points
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {Math.round((score.earnedPoints / score.totalPoints) * 100)}% correct
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Inspector Panel */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Inspector</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="zones" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="zones">Zones</TabsTrigger>
                      <TabsTrigger value="items">Items</TabsTrigger>
                      <TabsTrigger value="settings">Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="zones" className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Drop Zones ({exercise.zones.length})</h4>
                        <Dialog open={isZoneModalOpen} onOpenChange={setIsZoneModalOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" onClick={() => setEditingZone(null)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Zone
                            </Button>
                          </DialogTrigger>
                          <ZoneEditorModal
                            zone={editingZone}
                            exercise={exercise}
                            onSave={(zone) => {
                              if (editingZone) {
                                setExercise(prev => ({
                                  ...prev,
                                  zones: prev.zones.map(z => z.id === editingZone.id ? { ...zone, id: editingZone.id } : z),
                                }));
                              } else {
                                setExercise(prev => ({
                                  ...prev,
                                  zones: [...prev.zones, { ...zone, id: uuidv4() }],
                                }));
                              }
                              setIsZoneModalOpen(false);
                              setEditingZone(null);
                            }}
                            onClose={() => {
                              setIsZoneModalOpen(false);
                              setEditingZone(null);
                            }}
                          />
                        </Dialog>
                      </div>
                      
                      <div className="space-y-2">
                        {exercise.zones.map((zone) => (
                          <div
                            key={zone.id}
                            className="flex items-center justify-between p-3 bg-muted rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="font-medium">{zone.title}</div>
                              {zone.description && (
                                <div className="text-xs text-muted-foreground">{zone.description}</div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingZone(zone);
                                  setIsZoneModalOpen(true);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  // Remove zone and move its items to unassigned
                                  setPlacements(prev => 
                                    prev.map(p => 
                                      p.zoneId === zone.id ? { ...p, zoneId: null } : p
                                    )
                                  );
                                  setExercise(prev => ({
                                    ...prev,
                                    zones: prev.zones.filter(z => z.id !== zone.id),
                                    items: prev.items.map(item => 
                                      item.correctZoneId === zone.id 
                                        ? { ...item, correctZoneId: '' }
                                        : item
                                    ),
                                  }));
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {exercise.zones.length === 0 && (
                          <div className="text-center text-muted-foreground text-sm py-4">
                            No zones created yet
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="items" className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Items ({exercise.items.length})</h4>
                        <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              onClick={() => setEditingItem(null)}
                              disabled={exercise.zones.length === 0}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Item
                            </Button>
                          </DialogTrigger>
                          <ItemEditorModal
                            item={editingItem}
                            exercise={exercise}
                            onSave={(item) => {
                              if (editingItem) {
                                setExercise(prev => ({
                                  ...prev,
                                  items: prev.items.map(i => i.id === editingItem.id ? { ...item, id: editingItem.id } : i),
                                }));
                              } else {
                                const newItem = { ...item, id: uuidv4() };
                                setExercise(prev => ({
                                  ...prev,
                                  items: [...prev.items, newItem],
                                }));
                                setPlacements(prev => [...prev, { itemId: newItem.id, zoneId: null }]);
                              }
                              setIsItemModalOpen(false);
                              setEditingItem(null);
                            }}
                            onClose={() => {
                              setIsItemModalOpen(false);
                              setEditingItem(null);
                            }}
                          />
                        </Dialog>
                      </div>
                      
                      <div className="space-y-2">
                        {exercise.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-muted rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="font-medium">{item.text}</div>
                              <div className="text-xs text-muted-foreground">
                                Correct: {exercise.zones.find(z => z.id === item.correctZoneId)?.title || 'None'}
                                {item.points && item.points !== 1 && ` • ${item.points}pts`}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingItem(item);
                                  setIsItemModalOpen(true);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setPlacements(prev => prev.filter(p => p.itemId !== item.id));
                                  setExercise(prev => ({
                                    ...prev,
                                    items: prev.items.filter(i => i.id !== item.id),
                                  }));
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {exercise.items.length === 0 && (
                          <div className="text-center text-muted-foreground text-sm py-4">
                            No items created yet
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="instructions">Instructions</Label>
                          <Textarea
                            id="instructions"
                            placeholder="Enter instructions for students..."
                            value={exercise.instructions || ''}
                            onChange={(e) => setExercise(prev => ({
                              ...prev,
                              instructions: e.target.value,
                            }))}
                            className="mt-1"
                          />
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="shuffle">Shuffle Items</Label>
                            <Switch
                              id="shuffle"
                              checked={exercise.settings.shuffleItems}
                              onCheckedChange={(checked) => setExercise(prev => ({
                                ...prev,
                                settings: { ...prev.settings, shuffleItems: checked },
                              }))}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="multiple">Allow Multiple Per Zone</Label>
                            <Switch
                              id="multiple"
                              checked={exercise.settings.allowMultiplePerZone}
                              onCheckedChange={(checked) => setExercise(prev => ({
                                ...prev,
                                settings: { ...prev.settings, allowMultiplePerZone: checked },
                              }))}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="snap">Snap to Zone</Label>
                            <Switch
                              id="snap"
                              checked={exercise.settings.snapToZone}
                              onCheckedChange={(checked) => setExercise(prev => ({
                                ...prev,
                                settings: { ...prev.settings, snapToZone: checked },
                              }))}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="feedback">Show Instant Feedback</Label>
                            <Switch
                              id="feedback"
                              checked={exercise.settings.showInstantFeedback}
                              onCheckedChange={(checked) => setExercise(prev => ({
                                ...prev,
                                settings: { ...prev.settings, showInstantFeedback: checked },
                              }))}
                            />
                          </div>

                          <div>
                            <Label htmlFor="scoring">Scoring Method</Label>
                            <Select
                              value={exercise.settings.scoring}
                              onValueChange={(value: 'all-or-nothing' | 'per-item' | 'none') => 
                                setExercise(prev => ({
                                  ...prev,
                                  settings: { ...prev.settings, scoring: value },
                                }))
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="per-item">Per Item</SelectItem>
                                <SelectItem value="all-or-nothing">All or Nothing</SelectItem>
                                <SelectItem value="none">No Scoring</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="backgroundColor">Background Color</Label>
                            <div className="flex gap-2 mt-1">
                              <Input
                                id="backgroundColor"
                                type="color"
                                value={exercise.settings.backgroundColor || '#ffffff'}
                                onChange={(e) => setExercise(prev => ({
                                  ...prev,
                                  settings: { ...prev.settings, backgroundColor: e.target.value },
                                }))}
                                className="w-16 h-10 p-1 cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={exercise.settings.backgroundColor || '#ffffff'}
                                onChange={(e) => setExercise(prev => ({
                                  ...prev,
                                  settings: { ...prev.settings, backgroundColor: e.target.value },
                                }))}
                                placeholder="#ffffff"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardContent className="pt-6 space-y-3">
                  {exercise.zones.length === 0 && exercise.items.length === 0 && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={loadSampleData}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Load Sample Data
                    </Button>
                  )}
                  
                  <Button
                    className="w-full"
                    onClick={handleSave}
                    disabled={!canSave || isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Exercise'}
                  </Button>
                  
                  {validationErrors.length > 0 && (
                    <div className="text-xs text-destructive">
                      {validationErrors[0]}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DndContext>
    </div>
  );
};

// Zone Editor Modal Component
const ZoneEditorModal: React.FC<{
  zone: DragDropExerciseV1['zones'][0] | null;
  exercise: DragDropExerciseV1;
  onSave: (zone: Omit<DragDropExerciseV1['zones'][0], 'id'>) => void;
  onClose: () => void;
}> = ({ zone, exercise, onSave, onClose }) => {
  const [title, setTitle] = useState(zone?.title || '');
  const [description, setDescription] = useState(zone?.description || '');
  const [color, setColor] = useState(zone?.color || '');

  const isEdit = !!zone;
  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      color: color.trim() || undefined,
    });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Zone' : 'Add New Zone'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <Label htmlFor="zone-title">Title *</Label>
          <Input
            id="zone-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter zone title..."
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="zone-description">Description</Label>
          <Textarea
            id="zone-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="zone-color">Color (optional)</Label>
          <Input
            id="zone-color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#6CDBEF or color name"
            className="mt-1"
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave}>
          {isEdit ? 'Update' : 'Create'} Zone
        </Button>
      </div>
    </DialogContent>
  );
};

// Item Editor Modal Component
const ItemEditorModal: React.FC<{
  item: DragDropExerciseV1['items'][0] | null;
  exercise: DragDropExerciseV1;
  onSave: (item: Omit<DragDropExerciseV1['items'][0], 'id'>) => void;
  onClose: () => void;
}> = ({ item, exercise, onSave, onClose }) => {
  const [text, setText] = useState(item?.text || '');
  const [correctZoneId, setCorrectZoneId] = useState(item?.correctZoneId || '');
  const [points, setPoints] = useState((item?.points || 1).toString());
  const [correctFeedback, setCorrectFeedback] = useState(item?.feedback?.correct || '');
  const [incorrectFeedback, setIncorrectFeedback] = useState(item?.feedback?.incorrect || '');
  const [color, setColor] = useState(item?.color || '');

  const isEdit = !!item;
  const canSave = text.trim().length > 0 && correctZoneId.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    
    onSave({
      text: text.trim(),
      correctZoneId,
      points: parseInt(points) || 1,
      color: color.trim() || undefined,
      feedback: (correctFeedback.trim() || incorrectFeedback.trim()) ? {
        correct: correctFeedback.trim() || undefined,
        incorrect: incorrectFeedback.trim() || undefined,
      } : undefined,
    });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Item' : 'Add New Item'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <Label htmlFor="item-text">Text *</Label>
          <Input
            id="item-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter item text..."
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="item-zone">Correct Zone *</Label>
          <Select value={correctZoneId} onValueChange={setCorrectZoneId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select correct zone..." />
            </SelectTrigger>
            <SelectContent>
              {exercise.zones.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="item-points">Points</Label>
          <Input
            id="item-points"
            type="number"
            min="1"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="item-color">Color (optional)</Label>
          <Input
            id="item-color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#6CDBEF or color name"
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="correct-feedback">Correct Feedback</Label>
          <Input
            id="correct-feedback"
            value={correctFeedback}
            onChange={(e) => setCorrectFeedback(e.target.value)}
            placeholder="Message when correct..."
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="incorrect-feedback">Incorrect Feedback</Label>
          <Input
            id="incorrect-feedback"
            value={incorrectFeedback}
            onChange={(e) => setIncorrectFeedback(e.target.value)}
            placeholder="Message when incorrect..."
            className="mt-1"
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave}>
          {isEdit ? 'Update' : 'Create'} Item
        </Button>
      </div>
    </DialogContent>
  );
};

export default DragDropBuilder;