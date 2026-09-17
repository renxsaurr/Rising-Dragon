import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function StudentsPage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const { data: students, error } = await supabase
    .from('Student')
    .select('*, Branch(name)')

  if (error) {
    return <p>Something went wrong: {error.message}</p>
  }

  return (
    <div>
      <h1>Students</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Belt Level</th>
            <th>Branch</th>
            <th>Guardian Contact</th>
          </tr>
        </thead>
        <tbody>
          {students?.map((student) => (
            <tr key={student.id}>
              <td>{student.name}</td>
              <td>{student.belt_level}</td>
              <td>{student.Branch?.name}</td>
              <td>{student.guardian_contact}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}