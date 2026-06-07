import { useJournal } from '../contexts/JournalContext'

interface UserCursorsProps {
  pageIndex: number
}

export default function UserCursors({ pageIndex }: UserCursorsProps) {
  const { remoteCursors } = useJournal()

  return (
    <>
      {remoteCursors
        .filter(cursor => cursor.pageIndex === pageIndex)
        .map(cursor => (
          <div
            key={cursor.id}
            className="absolute pointer-events-none transition-all duration-100 z-50"
            style={{ left: cursor.x, top: cursor.y }}
          >
            <div
              className="w-3 h-3 rounded-full shadow-sm"
              style={{ backgroundColor: cursor.color }}
            />
            <div
              className="absolute top-4 left-4 px-2 py-1 rounded text-xs text-white whitespace-nowrap shadow-lg font-handwriting"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.name}
            </div>
          </div>
        ))}
    </>
  )
}
