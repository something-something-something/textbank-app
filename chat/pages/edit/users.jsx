import dynamic from 'next/dynamic';

const DynamicUserControls=dynamic(async ()=>{
	return (await import('../../components/UserControls')).AllUsersControls
},{ssr:false});

function UsersControlsPage(){
	return 	<DynamicUserControls/>
}

export default UsersControlsPage;