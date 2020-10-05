import {useState,useEffect} from 'react'
import {queryGraphQL} from '../lib/graphql'
import {useRouter} from 'next/router';


export function LoginForm(){
	const [userName,setUserName]=useState('');
	const [password,setPassword]=useState('');
	const [user,setUser]=useState(null);
	const router=useRouter();

	const [authFailure,setAuthFailure]=useState(false)
	const fetchData=async ()=>{
		let res=await queryGraphQL(`
			query{
				authenticatedUser{
					id
					email
				}
			}

		`,{});
		setUser(res.data.authenticatedUser);
	}
	useEffect(()=>{
		fetchData();
	},[])

	const signIn=async()=>{
		let res=await queryGraphQL(`
			mutation signin($email: String!, $pass: String!){
				authenticateUserWithPassword(email: $email, password: $pass){
					item{
						id
					}
					token
				}
			}
		`,{
			email:userName,
			pass:password
		});

		if(res.data.authenticateUserWithPassword===null){
			setAuthFailure(true);
		}
		else{
			router.push('/');
			
			setAuthFailure(false);
			
		}
		fetchData();
	}

	const signOut=async ()=>{
		await queryGraphQL(`
		mutation {
			unauthenticateUser{
				success
			}
		}
		`,{});
		fetchData();
	}

	return (<div>
		
		{authFailure&&(<div>
			FAILED LOGIN
		</div>)}
		{user===null&&(<>
			email:<input type="text" value={userName} onChange={(ev)=>{setUserName(ev.target.value)}}/>
			<br/>
			password:<input type="password" value={password} onChange={(ev)=>{setPassword(ev.target.value)}}/>
			<br/>
			<button onClick={()=>{signIn()}}>Sign In</button>
		</>)}
		
		{user!==null&&(<>
		<a href="/">Go to Scripts</a>
		<br/>
		
			<button onClick={()=>{
				signOut()
			}}>Sign Out</button>
			
		</>)}


	</div>);
}
