import "./App.css";
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';
import { TonConnectButton } from "@tonconnect/ui-react";
import { useTonConnectUI } from '@tonconnect/ui-react';
import WebApp from "@twa-dev/sdk";
import { Address, beginCell } from "ton-core";
import { useMasterContract } from "./hooks/useMasterContract"
import { useNavigate } from 'react-router-dom';

// import { getSenderJettonWalletAddress } from './getwalletaddress';

declare global { interface Window { Telegram: any; } }






const AdminDashboard = () => {

  const [page_n, setPageN] = useState(Number(0));
  const [, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [logedInUserEmail, setLogedInUserEmail] = useState('Guest');
  const [, setWelcomeDisplayName] = useState('Guest');
  const [error, setError] = useState<string | null>(null);
  const [tonConnectUI] = useTonConnectUI();
  const [, setTableData] = useState<any[]>([]);
  const [, setHaverow] = useState(false);

 


  const [shareRate, setShareRate] = useState(0);
  const [MasterTotalSuply, setMasterTotalSuply] = useState(999);















  const master_data = useMasterContract();

  useEffect(() => {
    if (master_data && master_data.share_rate !== undefined) {
      setShareRate(master_data.share_rate);
    }

    //must be removed
    if (master_data && master_data.total_supply !== undefined) {
      setMasterTotalSuply(master_data.total_supply);
    }


  }, [master_data]);









  const updateShareRateInMaster = async () => {
    try {
      // Fetch all users and calculate the total sum of Points
      const { data: totalPointsResult, error: totalPointsError } = await supabase
        .from('Usertbl')
        .select('Points');
      if (totalPointsError) {
        throw new Error(`Error fetching total points: ${totalPointsError.message}`);
      }
      // Calculate the total sum of Points
      const totalPoints = totalPointsResult.reduce((acc, user) => acc + user.Points, 0);
      let share_data_cell = beginCell()
        .storeUint(11, 32)
        .storeUint(totalPoints, 32)
        .endCell();
      const result = await tonConnectUI.sendTransaction({
        validUntil: Date.now() + 5 * 60 * 1000,
        messages: [
          {
            address: "kQD_VDXfdjRq2Nm-NOW3HwM4BFK6XBh6-8NUg4roLamJVf1s",
            amount: "10000000",
            payload: share_data_cell.toBoc().toString("base64"),
          }
        ]
      });
      if (result) {
        WebApp.showAlert("ShareRate updated successfully")
      }
    } catch (error) {
      console.error("Transaction failed:", error);
      WebApp.showAlert(`Transaction failed: ${error}`);
    }
  };


  async function handleSendPaybackOrder() {
    try {
      // Fetch the first three users with Points greater than zero
      const { data: users, error: fetchError } = await supabase
        .from('Usertbl')
        .select('OwnerAddress, TonAddress, Points, TotalGain')
        .gt('Points', 0)
        .limit(3);

      if (fetchError) {
        throw new Error(`Error fetching users: ${fetchError.message}`);
      }

      if (users.length === 0) {
        console.log('No users with Points greater than 0 found.');
        WebApp.showAlert('No users with Points greater than 0 found.');
        return;
      }

      // Create user array with gain calculations
      const userArray = users.map(user => ({
        OwnerAddress: user.OwnerAddress,
        TonAddress: user.TonAddress,
        Points: user.Points,
        TotalGain: user.TotalGain,
        GainAmount: shareRate * user.Points // Calculate gain amount
      }));

      console.log('Users fetched:', userArray);

      // Create the datacell for the current batch
      let datacellBuilder = beginCell()
        .storeUint(2, 32) // Indicates the type of transaction
        .storeUint(userArray.length, 32); // Number of users in the current batch

      // Add each user's address and points to the datacell
      userArray.forEach(user => {
        datacellBuilder
          .storeAddress(Address.parse(user.TonAddress))
          .storeCoins(user.Points);
      });

      const datacell = datacellBuilder.endCell();
      console.log('Datacell created:', datacell.toString());

      try {
        const result = await tonConnectUI.sendTransaction({
          validUntil: Date.now() + 5 * 60 * 1000, // Transaction valid for 5 minutes
          messages: [
            {
              address: "kQD_VDXfdjRq2Nm-NOW3HwM4BFK6XBh6-8NUg4roLamJVf1s",
              amount: "10000000",
              payload: datacell.toBoc().toString("base64"),
            }
          ]
        });

        if (result) {
          console.log('Transaction successful:', result);

          // Update Points, TotalGain, and LastGain for the users
          for (const user of userArray) {
            const updatedTotalGain = user.TotalGain + user.GainAmount;
            const { error: updateError } = await supabase
              .from('Usertbl')
              .update({
                Points: 0, // Reset Points to zero after transaction
                TotalGain: updatedTotalGain,
                LastGain: user.GainAmount // Store gain amount
              })
              .eq('OwnerAddress', user.OwnerAddress);

            if (updateError) {
              throw new Error(`Error updating user ${user.OwnerAddress}: ${updateError.message}`);
            }

            console.log(`User ${user.OwnerAddress} updated successfully: Points set to 0, TotalGain updated to ${updatedTotalGain}, LastGain set to ${user.GainAmount}`);
          }

          const transactionDetails = userArray.map(user => `OwnerAddress: ${user.OwnerAddress}, Points: 0, TotalGain: ${user.TotalGain + user.GainAmount}, LastGain: ${user.GainAmount}`).join('; ');
          console.log('All users updated successfully.');
          WebApp.showAlert(`Transaction successful for ${userArray.length} users. Details: ${transactionDetails}`);
        }
      } catch (error) {
        console.error('Error sending transaction:', error);
        WebApp.showAlert(`Error sending transaction: ${error}`);
      }

    } catch (error) {
      console.error('Error processing user points:', error);
      WebApp.showAlert(`Error processing user points: ${error}`);
    }

    // Fetch updated data
    await fetchData();
  }





  async function PaybackOnProhand() {
    try {
      // Fetch users with ProID not null or empty and ProPoint greater than 1000, limited to 3 users
      const { data: users, error: fetchError } = await supabase
        .from('Usertbl')
        .select('OwnerAddress, ProID, ProPoint, TonAddress, ProGain')
        .not('ProID', 'is', null)
        .not('ProID', 'eq', '')
        .gt('ProPoint', 1000)
        .limit(3);

      if (fetchError) {
        throw new Error(`Error fetching users: ${fetchError.message}`);
      }

      if (users.length === 0) {
        console.log('No users with ProPoint greater than 1000 found.');
        WebApp.showAlert('No users with ProPoint greater than 1000 found.');
        return;
      }

      // Create user array with necessary details
      const userArray = users.map(user => ({
        OwnerAddress: user.OwnerAddress,
        ProID: user.ProID,
        ProPoint: user.ProPoint,
        TonAddress: user.TonAddress,
        ProGain: user.ProGain
      }));

      // Create the datacell for the current batch
      let datacellBuilder = beginCell()
        .storeUint(3, 32) // Indicates the type of transaction
        .storeUint(userArray.length, 32); // Number of users in the current batch

      // Add each user's address and calculated payment to the datacell
      userArray.forEach(user => {
        const paymentAmount = (user.ProPoint * 1000) * 0.04;
        datacellBuilder
          .storeAddress(Address.parse(user.TonAddress))
          .storeCoins(paymentAmount);
        user.ProGain += paymentAmount; // Update the user's ProGain
        user.ProPoint = 0; // Reset ProPoint to zero
      });

      const datacell = datacellBuilder.endCell();

      try {
        const result = await tonConnectUI.sendTransaction({
          validUntil: Date.now() + 5 * 60 * 1000,
          messages: [
            {
              address: "kQD_VDXfdjRq2Nm-NOW3HwM4BFK6XBh6-8NUg4roLamJVf1s",
              amount: "10000000",
              payload: datacell.toBoc().toString("base64"),
            }
          ]
        });

        if (result) {
          // Update ProGain and ProPoint for the current batch of users
          for (const user of userArray) {
            const { error: updateError } = await supabase
              .from('Usertbl')
              .update({ ProGain: user.ProGain, ProPoint: user.ProPoint })
              .eq('OwnerAddress', user.OwnerAddress);

            if (updateError) {
              throw new Error(`Error updating user ${user.OwnerAddress}: ${updateError.message}`);
            }
          }
          console.log('Transaction and ProGain update successful.');
          WebApp.showAlert(`Transaction successful for ${userArray.length} users. Details: ${userArray.map(user => `Owner: ${user.OwnerAddress}, Amount: ${user.ProGain}`).join('; ')}`);
        }
      } catch (error) {
        console.error('Error sending transaction:', error);
        WebApp.showAlert(`Error sending transaction: ${error}`);
      }
    } catch (error) {
      console.error('Error processing user ProPoints:', error);
      WebApp.showAlert(`Error processing user ProPoints: ${error}`);
    }
    await fetchData();
  }













  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error(error);
      } else {
        setUser(data?.session?.user ?? null);
        if (data?.session?.user) {
          const displayName = await fetchUserDisplayName(data.session.user);
          setWelcomeDisplayName(displayName);
          setLogedInUserEmail(data.session.user.email ?? 'Guest');
        }
      }
    };
    getUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const fetchAndSetDisplayName = async () => {
          const displayName = await fetchUserDisplayName(session.user);
          setWelcomeDisplayName(displayName);
          setLogedInUserEmail(session.user.email ?? 'Guest');
        };
        fetchAndSetDisplayName();
      }
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);




  const fetchUserDisplayName = async (user: User) => {
    try {
      const displayName = user.user_metadata?.display_name;
      if (!displayName) {
        console.error('Display name not found');
        return 'Guest'; // Default display name
      }
      return displayName;
    } catch (error) {
      console.error('Error fetching display name:', error);
      return 'Guest'; // Default display name
    }
  };






const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();

  // Attempt login
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setError(error.message);
    return;
  }

  // Fetch logged-in user's details
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    console.error('Error fetching user:', userError?.message);
    return;
  }

  // Allow login only for the admin email
  if (userData.user.email !== "saeed.zng@gmail.com") {
    console.warn('Unauthorized access! Logging out.');
    await supabase.auth.signOut(); // Force logout
    setUser(null);
    setPageN(0);
    return;
  }

  console.log('Logged in as Admin!');
  setPageN(1);
};


  const handleSignOut = async () => {
    // Fetch the current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Error fetching session:', sessionError.message);
      return;
    }
    // Check if there is an active session
    if (!sessionData?.session) {
      console.error('No active session found!');
      return;
    }
    // Proceed to sign out if there is an active session
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    } else {
      setUser(null);
      console.log('Signed out successfully!');
      setPageN(0);
    }
  };


  async function updateUsersPoints() {
    try {
      // Fetch all users
      const { data: users, error: fetchError } = await supabase
        .from('Usertbl')
        .select('id, RightPoint, LeftPoint');
      if (fetchError) {
        throw new Error(`Error fetching users: ${fetchError.message}`);
      }
      // Iterate over each user and update points
      for (const user of users) {
        const { id, RightPoint, LeftPoint } = user;
        const minPoint = Math.min(RightPoint, LeftPoint);
        // Update the user's points
        const { error: updateError } = await supabase
          .from('Usertbl')
          .update({
            Points: minPoint,
            RightPoint: 0,
            LeftPoint: 0
          })
          .eq('id', id);
        if (updateError) {
          console.error(`Error updating user with id ${id}: ${updateError.message}`);
        }
      }
      console.log('Users points updated successfully');
      WebApp.showAlert('Users points updated successfully');
    } catch (error) {
      console.error('Error updating users points:', error);
    }
    await fetchData();
  }


  useEffect(() => {
    if (logedInUserEmail === 'Guest') return;
    fetchData();
  }, [logedInUserEmail]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from('Usertbl')
      .select()
      .eq('OwnerAddress', logedInUserEmail)
      .single(); // Fetch a single row where OwnerAddress matches logedInUserEmail

    if (error) {
      console.error('Error fetching data:', error);
      setHaverow(false);
    } else {
      // console.log('Fetched data:', data);
      setTableData([data]); // Set the single row data into an array to be compatible with setTableData
      setHaverow(!!data);
      console.log("logedInUserEmail is " + logedInUserEmail);
      console.log("have row is " + !!data);
    }
  };

  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData?.user || userData.user.email !== "saeed.zng@gmail.com") {
        console.warn("Access denied! Redirecting...");
        navigate("/"); // Redirect non-admins to the home page
      }
    };

    checkAdmin();
  }, []);

  return (
    <div className="wrapper">
      <div className="top-section">
        <div className="header">
          <div className="left">
            <img src="./logo.png" alt="Logo" className="logo" />
          </div>
          <div className="right">
            <TonConnectButton />
          </div>
        </div>
      </div>
      <div className="down-section">
        {/* login page */}
        {page_n === 0 && (
          <div className="form-container">
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
              <div>
                <label>Email:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Password:</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="error-message">{error}</p>}
              <button type="submit">Login</button>
            </form>
          </div>
        )}

        {/* Admin Page */}
        {page_n === 1 && (
          <div>
            <label>Share_rate = {shareRate}</label><br />
            <label>Master TotalSuply = {MasterTotalSuply}</label><br />
            <button className="action-button" onClick={updateUsersPoints}>1-Calculate real Points</button><br />
            <button className="action-button" onClick={updateShareRateInMaster}>2-Update share rate in master</button><br />
            <button className="action-button" onClick={handleSendPaybackOrder}>3-Payback</button><br />
            <button className="action-button" onClick={PaybackOnProhand}>3-Payback Pro Hand</button><br />
            <button className="action-button" onClick={handleSignOut}>Sign Out</button><br />

          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;


