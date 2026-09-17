import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function AttendancePage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const { data: attendance, error } = await supabase
    .from('Attendance')
    .select('*, Student(name), ClassSchedule(date, time_start, time_end, Branch(name), User(name))')

  if (error) {
    return <p>Something went wrong: {error.message}</p>
  }

  return (
    <div>
      <h1>Attendance</h1>
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Status</th>
            <th>Class Date</th>
            <th>Time</th>
            <th>Branch</th>
            <th>Coach</th>
          </tr>
        </thead>
        <tbody>
          {attendance?.map((record) => (
            <tr key={record.id}>
              <td>{record.Student?.name}</td>
              <td>{record.status}</td>
              <td>{record.ClassSchedule?.date}</td>
              <td>{record.ClassSchedule?.time_start} - {record.ClassSchedule?.time_end}</td>
              <td>{record.ClassSchedule?.Branch?.name}</td>
              <td>{record.ClassSchedule?.User?.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}