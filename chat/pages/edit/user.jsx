import dynamic from 'next/dynamic';

const DynamicUserEditForm=dynamic(async ()=>{
	return (await import('../../components/UserControls')).UserEditForm
},{ssr:false});

function UserEditFormPage(){
	return 	<DynamicUserEditForm/>
}

export default UserEditFormPage;