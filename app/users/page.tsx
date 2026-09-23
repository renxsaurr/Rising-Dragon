import {createClient} from '@/utils/supabase/server'
import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import AddUserModal from '@/components/AddBranchModal'
import {getCurrentUser } from '@/utils/getCurrentUser'

export default async function UsersPage() {
    
}