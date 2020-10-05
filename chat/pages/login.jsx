import dynamic from 'next/dynamic';

const DynamicLogin=dynamic(async ()=>{
	return (await import('../components/Login')).LoginForm
},{ssr:false});
const DynamicNavMenu=dynamic(()=>{
	return  import('../components/NavMenu')
},{ssr:false});
function LoginPage(){
	return 	<div><DynamicNavMenu/><DynamicLogin/></div>
}

export default LoginPage;