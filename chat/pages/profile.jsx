
import dynamic from 'next/dynamic';

const DynamicProfile=dynamic(async ()=>{
	return (await import('../components/Profile')).Profile
},{ssr:false});
const DynamicNavMenu=dynamic(()=>{
	return  import('../components/NavMenu')
},{ssr:false});

export default function UserProfilePage(props){
	return <div><DynamicNavMenu/><DynamicProfile/></div>;
}