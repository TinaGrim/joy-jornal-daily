import { useRef, useState } from 'react'
import { useToolDrag } from '@/hooks/useToolDrag'
import { Upload, ImageIcon, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

type ShapeMask = 'rectangle' | 'circle' | 'polaroid' | 'torn-edge' | 'cloud'

const masks: { id: ShapeMask; label: string; desc: string }[] = [
  { id: 'rectangle', label: 'Rect', desc: 'Clean crop' },
  { id: 'circle', label: 'Circle', desc: 'Round frame' },
  { id: 'polaroid', label: 'Polaroid', desc: 'Classic instant' },
  { id: 'torn-edge', label: 'Torn', desc: 'Ripped edge' },
  { id: 'cloud', label: 'Cloud', desc: 'Cloud shape' },
]

interface UploadedPhoto {
  id: string
  src: string
  name: string
}

function PhotoThumbnail({ photo, mask }: { photo: UploadedPhoto; mask: ShapeMask }) {
  const { isDragging, drag } = useToolDrag({
    elementType: 'image',
    data: { src: photo.src, mask },
    width: 150,
    height: 150,
  })

  return (
    <div
      ref={drag}
      className={cn(
        'group relative rounded-xl overflow-hidden border-2 border-border-light cursor-grab active:cursor-grabbing transition-all hover:shadow-lg hover:border-terracotta/40 hover:-translate-y-0.5',
        isDragging && 'opacity-50',
      )}
    >
      <img src={photo.src} alt={photo.name} className="w-full aspect-square object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      <div className="absolute bottom-0 left-0 right-0 p-1.5 text-xs text-white bg-gradient-to-t from-black/60 to-transparent truncate font-handwriting">
        {photo.name}
      </div>
      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-white/80 backdrop-blur-xs rounded text-[10px] text-warm-brown font-handwriting capitalize">
        {mask}
      </div>
    </div>
  )
}

export default function PhotoPanel() {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedMask, setSelectedMask] = useState<ShapeMask>('rectangle')

  const handleUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => {
          setPhotos(prev => [
            ...prev,
            { id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, src: reader.result as string, name: file.name },
          ])
        }
        reader.readAsDataURL(file)
      }
    })
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-cream border-2 border-border-light">
        <p className="text-sm text-warm-brown mb-3 font-handwriting">Upload your travel photos</p>
        <button
          onClick={handleUpload}
          className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-border-dark bg-white hover:bg-cream-dark hover:border-terracotta transition-all flex items-center justify-center gap-2 cursor-pointer font-handwriting text-warm-brown group"
        >
          <Upload className="w-5 h-5 group-hover:text-terracotta transition-colors" />
          <span className="group-hover:text-terracotta transition-colors">Upload Photo</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-4 h-4 text-warm-brown" />
          <p className="text-sm text-warm-brown font-handwriting">Photo Shape</p>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {masks.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMask(m.id)}
              className={cn(
                'py-2 px-1 rounded-lg border text-xs font-handwriting transition-all cursor-pointer',
                selectedMask === m.id
                  ? 'border-terracotta bg-terracotta text-white shadow-sm'
                  : 'border-border-light bg-white text-warm-brown hover:border-terracotta/50 hover:bg-terracotta/5',
              )}
              title={m.desc}
            >
              <span className="block leading-tight">{m.label}</span>
              <span className="block text-[9px] opacity-60 leading-tight mt-0.5">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted bg-cream rounded-xl border-2 border-dashed border-border-light">
          <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-handwriting text-lg">No photos yet</p>
          <p className="font-handwriting text-sm opacity-60">Upload to get started</p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-warm-brown mb-3 font-handwriting">Drag a photo to the page</p>
          <div className="grid grid-cols-2 gap-3">
            {photos.map(photo => (
              <PhotoThumbnail key={photo.id} photo={photo} mask={selectedMask} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
