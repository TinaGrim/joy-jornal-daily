import { useRef, useState, useMemo } from 'react'
import { uploadString, getDownloadURL, ref as storageRef } from 'firebase/storage'
import { storage, auth, isFirebaseReady } from '@/lib/firebase'
import { storePhotoData, makePhotoRef, usePhotoSrc } from '@/lib/photoBank'
import { useToolDrag } from '@/hooks/useToolDrag'
import { useTheme } from '../../contexts/ThemeContext'
import { useJournal } from '../../contexts/JournalContext'
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

function PhotoThumbnail({ photo, mask, isDark }: { photo: UploadedPhoto; mask: ShapeMask; isDark: boolean }) {
  const data = useMemo(() => ({ src: photo.src, mask }), [photo.src, mask])
  const thumbSrc = usePhotoSrc(photo.src)
  const { isDragging, drag, insert } = useToolDrag({
    elementType: 'image',
    data,
    width: 150,
    height: 150,
  })

  return (
    <div
      ref={drag}
      onClick={insert}
      className={cn(
        'group relative rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all hover:shadow-lg hover:-translate-y-0.5',
        isDark ? 'border-[#45475a] hover:border-terracotta/40' : 'border-border-light hover:border-terracotta/40',
        isDragging && 'opacity-50',
      )}
    >
      <img src={thumbSrc ?? photo.src} alt={photo.name} className="w-full aspect-square object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      <div className="absolute bottom-0 left-0 right-0 p-1.5 text-xs text-white bg-gradient-to-t from-black/60 to-transparent truncate font-handwriting">
        {photo.name}
      </div>
      <div className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 backdrop-blur-xs rounded text-[12px] font-handwriting capitalize ${isDark ? 'bg-[#313244]/80 text-[#a6adc8]' : 'bg-white/80 text-warm-brown'}`}>
        {mask}
      </div>
    </div>
  )
}

export default function PhotoPanel() {
  const { uploadedPhotos: photos, addUploadedPhotos } = useJournal()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedMask, setSelectedMask] = useState<ShapeMask>('rectangle')
  const { theme } = useTheme()
  const isDark = theme === 'night'

  const handleUpload = () => {
    fileInputRef.current?.click()
  }

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  const uploadPhoto = async (file: File): Promise<UploadedPhoto> => {
    const id = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const dataUrl = await readFile(file)
    let src = dataUrl
    if (isFirebaseReady && auth?.currentUser) {
      try {
        const ext = file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '.jpg'
        const photoRef = storageRef(storage!, `photos/${auth.currentUser.uid}/${id}${ext}`)
        await uploadString(photoRef, dataUrl, 'data_url')
        src = await getDownloadURL(photoRef)
      } catch (err) {
        console.warn(`[PhotoPanel] Storage upload failed for ${file.name}, storing in photo bank:`, err)
        storePhotoData(id, dataUrl)
        src = makePhotoRef(id)
      }
    }
    return { id, src, name: file.name }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    const oversized = imageFiles.filter(f => f.size > 8 * 1024 * 1024)
    oversized.forEach(f =>
      console.warn(`[PhotoPanel] Skipping ${f.name}: ${(f.size / (1024 * 1024)).toFixed(1)}MB exceeds the 8MB limit`)
    )
    const validFiles = imageFiles.filter(f => f.size <= 8 * 1024 * 1024)
    const newPhotos = await Promise.all(validFiles.map(uploadPhoto))
    if (newPhotos.length > 0) {
      addUploadedPhotos(newPhotos)
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-xl border-2 ${isDark ? 'bg-[#181825] border-[#45475a]' : 'bg-cream border-border-light'}`}>
        <p className={`text-sm mb-3 font-handwriting ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Upload your travel photos</p>
        <button
          onClick={handleUpload}
          className={`w-full py-3 px-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 cursor-pointer font-handwriting transition-all group ${isDark ? 'border-[#45475a] bg-[#313244] text-[#a6adc8] hover:border-terracotta hover:text-terracotta' : 'border-border-dark bg-white text-warm-brown hover:bg-cream-dark hover:border-terracotta hover:text-terracotta'}`}
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
          <Camera className={`w-4 h-4 ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`} />
          <p className={`text-sm font-handwriting ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Photo Shape</p>
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
                  : isDark
                    ? 'border-[#45475a] bg-[#313244] text-[#a6adc8] hover:border-terracotta/50 hover:bg-terracotta/10'
                    : 'border-border-light bg-white text-warm-brown hover:border-terracotta/50 hover:bg-terracotta/5',
              )}
              title={m.desc}
            >
              <span className="block leading-tight">{m.label}</span>
              <span className="block text-[11px] opacity-60 leading-tight mt-0.5">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {photos.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed ${isDark ? 'text-[#6c7086] bg-[#181825] border-[#45475a]' : 'text-text-muted bg-cream border-border-light'}`}>
          <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-handwriting text-lg">No photos yet</p>
          <p className="font-handwriting text-sm opacity-60">Upload to get started</p>
        </div>
      ) : (
        <div>
          <p className={`text-sm mb-3 font-handwriting ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Drag a photo to the page</p>
          <div className="grid grid-cols-2 gap-3">
            {photos.map(photo => (
              <PhotoThumbnail key={photo.id} photo={photo} mask={selectedMask} isDark={isDark} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
