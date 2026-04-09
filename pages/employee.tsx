import type { GetServerSideProps } from 'next'
export default function OldEmployee() { return null }
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/admin/employees', permanent: true },
})
