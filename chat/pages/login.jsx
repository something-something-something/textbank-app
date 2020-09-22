import dynamic from 'next/dynamic';

const DynamicLogin=dynamic(async ()=>{
	return (await import('../components/Login')).LoginForm
},{ssr:false});

function LoginPage(){
	return 	<DynamicLogin/>
}

export default LoginPage;