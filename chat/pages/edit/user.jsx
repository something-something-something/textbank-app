import dynamic from 'next/dynamic';

const DynamicUserEditForm=dynamic(async ()=>{
	return (await import('../../components/UserControls')).UserEditForm
},{ssr:false});
const DynamicNavMenu=dynamic(()=>{
	return  import('../../components/NavMenu')
},{ssr:false});

function UserEditFormPage(){
	return 	<div><DynamicNavMenu/><DynamicUserEditForm/></div>
}

export default UserEditFormPage;