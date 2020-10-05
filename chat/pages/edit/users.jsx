import dynamic from 'next/dynamic';

const DynamicUserControls=dynamic(async ()=>{
	return (await import('../../components/UserControls')).AllUsersControls
},{ssr:false});


const DynamicNavMenu=dynamic(()=>{
	return  import('../../components/NavMenu')
},{ssr:false});
function UsersControlsPage(){
	return 	<div><DynamicNavMenu/><DynamicUserControls/></div>
}

export default UsersControlsPage;