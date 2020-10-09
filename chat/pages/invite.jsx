import {useEffect,useState} from 'react';
import {useRouter} from 'next/router'
import {queryGraphQL} from '../lib/graphql';
import dynamic from 'next/dynamic';

const DynamicNavMenu=dynamic(()=>{
	return  import('../components/NavMenu')
},{ssr:false});

export default function AcceptInvite(props){
	const [passwordA,setPasswordA]=useState('');
	const [passwordB,setPasswordB]=useState('');
	const router=useRouter();
	let token=router.query.token!==undefined?router.query.token:'';

	const addUser=async ()=>{
		let res=await queryGraphQL(`
			mutation($token:String!,$password:String!){
				createVolunteerFromToken(token:$token,password:$password){
					success
				}
			}
		`,
		{
			token:token,
			password:passwordA
		});

		if(res.data.createVolunteerFromToken.success){
			router.push('/login')
		}
		else{
			alert('Failed');
		}
	}
	

	let issuesWithPass=[];
	if(passwordA!==passwordB){
		issuesWithPass.push('Passwords must match');
	}
	if(passwordA.length<8){
		issuesWithPass.push('password must be at least 8 characters');
	}

	return (<div>
		<DynamicNavMenu/>
		Create a password to join.<br/>
		Password:<input type="password" value={passwordA} onChange={(ev)=>{setPasswordA(ev.target.value)}}/><br/>
		ReType Password:<input type="password" value={passwordB} onChange={(ev)=>{setPasswordB(ev.target.value)}}/><br/>
		{issuesWithPass.length>0&&(<ul>
			{issuesWithPass.map((el)=>{
			return <li key={el}>{el}</li>
		})}
		</ul>
		)}
		{issuesWithPass.length===0&&(<button onClick={addUser}>Join</button>)}

	</div>);
}